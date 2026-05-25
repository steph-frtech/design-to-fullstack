// governance-check.ts — aggregates guardrails for apply/codegen flows.
//
// runGovernanceChecks() runs the subset of guardrails relevant to a given
// operation and returns a GovernanceReport.  ok === false when at least one
// violation has severity "block".

import {
	guardNoInlineSecrets,
	guardDeleteRequiresValidation,
	guardNoUnknownExprFunctions,
	guardValidateBeforeApply,
	guardNoCriticalOpenQuestions,
	guardCodegenNeedsArtifactTracking,
	type DeleteOpts,
	type CodegenOpts,
} from "./guardrails";
import { prisma } from "../../db";

// ─── Report types ──────────────────────────────────────────────────────────────

export type ViolationSeverity = "block" | "warn";

export type GovernanceViolation = {
	code: string;
	message: string;
	severity: ViolationSeverity;
	details?: unknown;
};

export type GovernanceReport = {
	ok: boolean;
	violations: GovernanceViolation[];
	passed: string[];
};

// ─── Options ───────────────────────────────────────────────────────────────────

export type GovernanceCheckOpts = {
	/** Set when checking an apply operation */
	apply?: {
		confirmDeletes?: boolean;
	};
	/** Set when checking a codegen operation */
	codegen?: CodegenOpts;
	/** Whether to run the clarification gate (requires DB) */
	checkClarificationGate?: boolean;
};

// ─── Main aggregator ───────────────────────────────────────────────────────────

export async function runGovernanceChecks(
	projectId: string,
	deltaSpec: unknown,
	opts: GovernanceCheckOpts = {},
): Promise<GovernanceReport> {
	const violations: GovernanceViolation[] = [];
	const passed: string[] = [];

	// Helper: run a sync guard
	function runSync(
		label: string,
		result: { ok: boolean; code: string; message: string; details?: unknown },
		severity: ViolationSeverity = "block",
	): void {
		if (result.ok) {
			passed.push(result.code);
		} else {
			violations.push({ code: result.code, message: result.message, severity, details: result.details });
		}
	}

	// ─── 1. Inline secrets ───────────────────────────────────────────────────
	runSync("inline_secrets", guardNoInlineSecrets(deltaSpec));

	// ─── 2. Unknown Expr functions ───────────────────────────────────────────
	runSync("unknown_expr_functions", guardNoUnknownExprFunctions(deltaSpec));

	// ─── 3. Delete requires validation ──────────────────────────────────────
	const deleteOpts: DeleteOpts = { confirmDeletes: opts.apply?.confirmDeletes };
	runSync("delete_requires_validation", guardDeleteRequiresValidation(deltaSpec, deleteOpts));

	// ─── 4. Validate before apply ────────────────────────────────────────────
	// Load DB context for cross-ref checks
	const [existingEntities, existingOperations] = await Promise.all([
		prisma.entity.findMany({ where: { projectId }, select: { name: true } }),
		prisma.operation.findMany({ where: { projectId }, select: { name: true } }),
	]);
	const validationCtx = {
		existingEntityNames: new Set(existingEntities.map((e) => e.name)),
		existingOperationNames: new Set(existingOperations.map((o) => o.name)),
	};
	runSync("validate_before_apply", guardValidateBeforeApply(deltaSpec, validationCtx));

	// ─── 5. Codegen artifact tracking ────────────────────────────────────────
	if (opts.codegen) {
		runSync("codegen_needs_artifact_tracking", guardCodegenNeedsArtifactTracking(opts.codegen));
	}

	// ─── 6. Critical open questions ──────────────────────────────────────────
	if (opts.checkClarificationGate) {
		const result = await guardNoCriticalOpenQuestions(projectId);
		if (result.ok) {
			passed.push(result.code);
		} else {
			violations.push({ code: result.code, message: result.message, severity: "block", details: result.details });
		}
	}

	const blocked = violations.some((v) => v.severity === "block");
	return {
		ok: !blocked,
		violations,
		passed,
	};
}
