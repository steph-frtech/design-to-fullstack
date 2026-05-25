// Governance guardrails — deterministic checks that run before any apply/codegen.
// Each function returns a GuardResult with { ok, code, message, details? }.
// None of these functions call the DB (except guardNoCriticalOpenQuestions which
// delegates to checkClarificationGate). None of them call an LLM.

import { EXPR_FUNCTIONS } from "../dsl/expr-ast";
import { collectExprCalls } from "../dsl/expr-analyze";
import { validateDeltaSpec } from "../delta-spec-validation";
import type { DeltaSpecValidationCtx } from "../delta-spec-validation";
import { checkClarificationGate } from "../clarification-gate";
import type { Expr } from "../dsl/expr-ast";

// ─── Shared result type ────────────────────────────────────────────────────────

export type GuardResult = {
	ok: boolean;
	code: string;
	message: string;
	details?: unknown;
};

// ─── 1. guardChangeSetRequired ────────────────────────────────────────────────
// Checks that a ChangeSet context is present before allowing a write.
// ctx must expose a changeSetId (the CSStore from changeset-context).

export type ChangeSetCtx = { changeSetId?: string | null };

export function guardChangeSetRequired(ctx: ChangeSetCtx): GuardResult {
	if (!ctx.changeSetId) {
		return {
			ok: false,
			code: "changeset_required",
			message: "No active ChangeSet found. All writes must occur within a ChangeSet context.",
		};
	}
	return { ok: true, code: "changeset_required", message: "ChangeSet context present." };
}

// ─── 2. guardNoInlineSecrets ──────────────────────────────────────────────────
// Heuristic scan for inline secret values in a DeltaSpec or spec fragment.
// Scans:
//   - Top-level known secret key names (password, secret, apiKey, token, ...) whose
//     value is a non-empty string that does not look like a $ref / secretRef.
//   - Values matching known secret prefixes (sk_live_, figd_, AKIA, etc.).
//   - Values that look like long base64/hex tokens (>= 32 char, no spaces).
//
// Returns the violations with the path where they were found.

type SecretViolation = { path: string; reason: string };

const SECRET_KEY_PATTERNS = [
	/^(api[-_]?key|apikey)$/i,
	/^(secret[-_]?key|secretkey|secret)$/i,
	/^(access[-_]?token|accesstoken)$/i,
	/^(auth[-_]?token|authtoken|token)$/i,
	/^(password|passwd|pwd)$/i,
	/^(private[-_]?key|privatekey)$/i,
	/^(client[-_]?secret|clientsecret)$/i,
];

const SECRET_VALUE_PREFIXES = [
	/^sk_live_/,
	/^sk_test_/,
	/^figd_/,
	/^AKIA[0-9A-Z]{16}/,  // AWS access key
	/^ghp_/,               // GitHub personal access token
	/^glpat-/,             // GitLab personal access token
	/^xoxb-/,              // Slack bot token
	/^xoxp-/,              // Slack user token
];

// "secretRef" or "$ref" style values are safe (they reference a variable)
const SAFE_VALUE_RE = /^(\$ref:|secretRef:|env:|vault:|{)/;

// Long base64 or hex strings >= 32 chars with no whitespace are suspicious
const LONG_TOKEN_RE = /^[A-Za-z0-9+/=_\-.]{32,}$/;

function collectSecretViolations(obj: unknown, path: string, violations: SecretViolation[]): void {
	if (obj === null || typeof obj !== "object") return;

	if (Array.isArray(obj)) {
		for (let i = 0; i < obj.length; i++) {
			collectSecretViolations(obj[i], `${path}[${i}]`, violations);
		}
		return;
	}

	for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
		const childPath = path ? `${path}.${key}` : key;

		if (typeof value === "string" && value.length > 0) {
			// Check if the key looks like a secret field
			const keyLooksLikeSecret = SECRET_KEY_PATTERNS.some((re) => re.test(key));
			if (keyLooksLikeSecret && !SAFE_VALUE_RE.test(value)) {
				violations.push({
					path: childPath,
					reason: `Field "${key}" appears to contain an inline secret value. Use secretRef/env ref instead.`,
				});
				continue; // already flagged, skip further checks on this value
			}

			// Check for known secret prefixes
			if (SECRET_VALUE_PREFIXES.some((re) => re.test(value))) {
				violations.push({
					path: childPath,
					reason: `Value at "${childPath}" matches a known secret prefix pattern.`,
				});
				continue;
			}

			// Check for suspiciously long tokens (but not in benign fields like name/description)
			const keyLooksLikeData = /^(name|description|title|key|id|slug|namespace|text|content|message|label|kind|type|provider|scope|source|status|path|url|endpoint|host|port)$/i.test(key);
			if (!keyLooksLikeData && LONG_TOKEN_RE.test(value) && value.length >= 40) {
				violations.push({
					path: childPath,
					reason: `Value at "${childPath}" looks like a long token/key (${value.length} chars, no spaces). Use secretRef/env ref instead.`,
				});
				continue;
			}
		}

		// Recurse into nested objects/arrays
		if (typeof value === "object" && value !== null) {
			collectSecretViolations(value, childPath, violations);
		}
	}
}

export function guardNoInlineSecrets(deltaSpec: unknown): GuardResult {
	const violations: SecretViolation[] = [];
	collectSecretViolations(deltaSpec, "", violations);

	if (violations.length > 0) {
		return {
			ok: false,
			code: "inline_secrets_detected",
			message: `${violations.length} inline secret(s) detected. Remove them and use secretRef/env references.`,
			details: violations,
		};
	}
	return { ok: true, code: "inline_secrets_detected", message: "No inline secrets detected." };
}

// ─── 3. guardDeleteRequiresValidation ─────────────────────────────────────────
// Any bucket with a non-empty .delete array requires confirmDeletes=true.

export type DeleteOpts = { confirmDeletes?: boolean };

export function guardDeleteRequiresValidation(
	deltaSpec: unknown,
	opts: DeleteOpts,
): GuardResult {
	if (opts.confirmDeletes === true) {
		return {
			ok: true,
			code: "delete_requires_validation",
			message: "Delete confirmed by caller.",
		};
	}

	if (!deltaSpec || typeof deltaSpec !== "object" || Array.isArray(deltaSpec)) {
		return { ok: true, code: "delete_requires_validation", message: "No deletes found." };
	}

	const buckets: string[] = [];
	for (const [key, block] of Object.entries(deltaSpec as Record<string, unknown>)) {
		if (
			block &&
			typeof block === "object" &&
			!Array.isArray(block) &&
			Array.isArray((block as Record<string, unknown>).delete) &&
			((block as Record<string, unknown>).delete as unknown[]).length > 0
		) {
			buckets.push(key);
		}
	}

	if (buckets.length > 0) {
		return {
			ok: false,
			code: "delete_requires_validation",
			message: `DeltaSpec contains deletes in [${buckets.join(", ")}] but confirmDeletes was not set to true.`,
			details: { bucketsWithDeletes: buckets },
		};
	}

	return { ok: true, code: "delete_requires_validation", message: "No unconfirmed deletes." };
}

// ─── 4. guardNoUnknownExprFunctions ───────────────────────────────────────────
// Walks all Expr nodes in the DeltaSpec (operations.steps, policies.rule, etc.)
// and checks that every function call is in EXPR_FUNCTIONS.

type ExprLike = { call?: string; args?: ExprLike[] } | { obj?: Record<string, ExprLike> } | { arr?: ExprLike[] } | { lit?: unknown } | { ref?: string };

function walkExprs(obj: unknown, collector: string[]): void {
	if (!obj || typeof obj !== "object") return;
	if (Array.isArray(obj)) {
		for (const item of obj) walkExprs(item, collector);
		return;
	}
	const o = obj as Record<string, unknown>;
	// If this looks like an Expr node, collect its calls
	if ("call" in o || "lit" in o || "ref" in o || "arr" in o || "obj" in o) {
		try {
			const calls = collectExprCalls(obj as Expr);
			for (const c of calls) collector.push(c);
		} catch {
			// not a valid Expr node, skip
		}
		return;
	}
	// Otherwise recurse into all values
	for (const val of Object.values(o)) {
		walkExprs(val, collector);
	}
}

export function guardNoUnknownExprFunctions(deltaSpec: unknown): GuardResult {
	const allCalls: string[] = [];
	walkExprs(deltaSpec, allCalls);

	const known = new Set(Object.keys(EXPR_FUNCTIONS));
	const unknown_calls = [...new Set(allCalls)].filter((c) => !known.has(c));

	if (unknown_calls.length > 0) {
		return {
			ok: false,
			code: "unknown_expr_functions",
			message: `Unknown Expr function(s): ${unknown_calls.join(", ")}. Allowed: ${Object.keys(EXPR_FUNCTIONS).join(", ")}.`,
			details: { unknownCalls: unknown_calls },
		};
	}

	return {
		ok: true,
		code: "unknown_expr_functions",
		message: "All Expr function calls are known.",
	};
}

// ─── 5. guardValidateBeforeApply ─────────────────────────────────────────────
// Runs validateDeltaSpec. If it fails, returns a block-severity violation.

export function guardValidateBeforeApply(
	deltaSpec: unknown,
	ctx: DeltaSpecValidationCtx,
): GuardResult {
	const result = validateDeltaSpec(deltaSpec, ctx);
	if (!result.ok) {
		return {
			ok: false,
			code: "validate_before_apply",
			message: `DeltaSpec validation failed with ${result.errors.length} error(s).`,
			details: result.errors,
		};
	}
	return {
		ok: true,
		code: "validate_before_apply",
		message: "DeltaSpec is structurally valid.",
	};
}

// ─── 6. guardCodegenNeedsArtifactTracking ─────────────────────────────────────
// A non-dryRun codegen MUST pass trackArtifacts=true to ensure GeneratedArtifact
// rows are written. dryRun codegen is always allowed.

export type CodegenOpts = {
	dryRun?: boolean;
	trackArtifacts?: boolean;
};

export function guardCodegenNeedsArtifactTracking(opts: CodegenOpts): GuardResult {
	if (opts.dryRun === true) {
		return {
			ok: true,
			code: "codegen_needs_artifact_tracking",
			message: "dryRun codegen — artifact tracking not required.",
		};
	}
	if (!opts.trackArtifacts) {
		return {
			ok: false,
			code: "codegen_needs_artifact_tracking",
			message: "Non-dryRun codegen must set trackArtifacts:true to ensure GeneratedArtifact rows are written.",
		};
	}
	return {
		ok: true,
		code: "codegen_needs_artifact_tracking",
		message: "Artifact tracking enabled for codegen.",
	};
}

// ─── 7. guardNoCriticalOpenQuestions ─────────────────────────────────────────
// Wraps checkClarificationGate. Blocks generation if any question/assumption is OPEN.

export async function guardNoCriticalOpenQuestions(projectId: string): Promise<GuardResult> {
	const gate = await checkClarificationGate(projectId);
	if (gate.blocked) {
		return {
			ok: false,
			code: "critical_open_questions",
			message: `Generation blocked: ${gate.openQuestions.length} open question(s) and ${gate.openAssumptions.length} open assumption(s) must be resolved first.`,
			details: {
				openQuestions: gate.openQuestions,
				openAssumptions: gate.openAssumptions,
			},
		};
	}
	return {
		ok: true,
		code: "critical_open_questions",
		message: "No blocking open questions or assumptions.",
	};
}
