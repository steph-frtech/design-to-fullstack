// Static validation for PolicyRule.
// Validates Zod structure + Expr internals + regex validity for `matches`.

import { validateExpr, type ExprError } from "./expr-validate";
import { type PolicyRule, policyRuleSchema } from "./policy-dsl";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PolicyValidateCtx = {
	/** Passed to validateExpr — typically empty for standalone Policy. */
	availableStepAliases?: string[];
};

export type PolicyError = { path: string; code: string; message: string };
export type PolicyValidateResult = { ok: boolean; errors: PolicyError[] };

// ─── Main entry ──────────────────────────────────────────────────────────────

export function validatePolicyRule(
	rule: unknown,
	ctx: PolicyValidateCtx = {},
): PolicyValidateResult {
	const errors: PolicyError[] = [];

	const parsed = policyRuleSchema.safeParse(rule);
	if (!parsed.success) {
		for (const issue of parsed.error.issues) {
			errors.push({
				path: issue.path.join("."),
				code: "zod_parse",
				message: issue.message,
			});
		}
		return { ok: false, errors };
	}

	validateRule(parsed.data, "$", ctx, errors);
	return { ok: errors.length === 0, errors };
}

// ─── Recursive rule validation ────────────────────────────────────────────────

function validateRule(
	rule: PolicyRule,
	path: string,
	ctx: PolicyValidateCtx,
	errors: PolicyError[],
): void {
	const exprCtx = { availableStepAliases: ctx.availableStepAliases };

	if ("all" in rule) {
		if (rule.all.length === 0) {
			errors.push({ path: `${path}.all`, code: "empty_combinator", message: '"all" array must not be empty' });
		}
		rule.all.forEach((r, i) => validateRule(r, `${path}.all[${i}]`, ctx, errors));
		return;
	}
	if ("any" in rule) {
		if (rule.any.length === 0) {
			errors.push({ path: `${path}.any`, code: "empty_combinator", message: '"any" array must not be empty' });
		}
		rule.any.forEach((r, i) => validateRule(r, `${path}.any[${i}]`, ctx, errors));
		return;
	}
	if ("not" in rule) {
		validateRule(rule.not, `${path}.not`, ctx, errors);
		return;
	}

	// Binary comparisons — left = [0], right = [1]
	for (const key of ["eq", "neq", "in", "gt", "gte", "lt", "lte"] as const) {
		if (key in rule) {
			const pair = (rule as Record<string, unknown>)[key] as [unknown, unknown];
			pushExprErrors(validateExpr(pair[0], exprCtx), `${path}.${key}[0]`, errors);
			pushExprErrors(validateExpr(pair[1], exprCtx), `${path}.${key}[1]`, errors);
			return;
		}
	}

	if ("exists" in rule) {
		pushExprErrors(validateExpr(rule.exists, exprCtx), `${path}.exists`, errors);
		return;
	}

	if ("matches" in rule) {
		const [exprNode, pattern] = rule.matches as [unknown, string];
		pushExprErrors(validateExpr(exprNode, exprCtx), `${path}.matches[0]`, errors);
		// Validate regex
		try {
			new RegExp(pattern);
		} catch {
			errors.push({
				path: `${path}.matches[1]`,
				code: "invalid_regex",
				message: `"${pattern}" is not a valid regular expression`,
			});
		}
		return;
	}
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pushExprErrors(
	result: { ok: boolean; errors: ExprError[] },
	prefix: string,
	out: PolicyError[],
): void {
	for (const e of result.errors) {
		out.push({
			path: e.path ? `${prefix}.${e.path}` : prefix,
			code: e.code,
			message: e.message,
		});
	}
}
