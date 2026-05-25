// Runtime evaluator for PolicyRule (new typed Expr DSL — policy-dsl.ts).
// evalPolicyRule is synchronous and pure.
//
// Legacy async evalPolicy (old string-based DSL) is kept below for backward
// compatibility with any callers that still import from this file.

import { evalExpr, type ExprScope } from "./expr-eval";
import type { PolicyRule } from "./policy-dsl";

// ─── New typed DSL evaluator ──────────────────────────────────────────────────

export function evalPolicyRule(rule: PolicyRule, scope: ExprScope): boolean {
	if ("all" in rule) {
		return rule.all.every((r) => evalPolicyRule(r, scope));
	}

	if ("any" in rule) {
		return rule.any.some((r) => evalPolicyRule(r, scope));
	}

	if ("not" in rule) {
		return !evalPolicyRule(rule.not, scope);
	}

	if ("eq" in rule) {
		const [l, r] = rule.eq as [Parameters<typeof evalExpr>[0], Parameters<typeof evalExpr>[0]];
		return evalExpr(l, scope) === evalExpr(r, scope);
	}

	if ("neq" in rule) {
		const [l, r] = rule.neq as [Parameters<typeof evalExpr>[0], Parameters<typeof evalExpr>[0]];
		return evalExpr(l, scope) !== evalExpr(r, scope);
	}

	if ("in" in rule) {
		const [l, r] = rule.in as [Parameters<typeof evalExpr>[0], Parameters<typeof evalExpr>[0]];
		const left = evalExpr(l, scope);
		const right = evalExpr(r, scope);
		if (!Array.isArray(right)) return false;
		return right.includes(left);
	}

	if ("gt" in rule) {
		const [l, r] = rule.gt as [Parameters<typeof evalExpr>[0], Parameters<typeof evalExpr>[0]];
		return (evalExpr(l, scope) as number) > (evalExpr(r, scope) as number);
	}

	if ("gte" in rule) {
		const [l, r] = rule.gte as [Parameters<typeof evalExpr>[0], Parameters<typeof evalExpr>[0]];
		return (evalExpr(l, scope) as number) >= (evalExpr(r, scope) as number);
	}

	if ("lt" in rule) {
		const [l, r] = rule.lt as [Parameters<typeof evalExpr>[0], Parameters<typeof evalExpr>[0]];
		return (evalExpr(l, scope) as number) < (evalExpr(r, scope) as number);
	}

	if ("lte" in rule) {
		const [l, r] = rule.lte as [Parameters<typeof evalExpr>[0], Parameters<typeof evalExpr>[0]];
		return (evalExpr(l, scope) as number) <= (evalExpr(r, scope) as number);
	}

	if ("exists" in rule) {
		const val = evalExpr(rule.exists as Parameters<typeof evalExpr>[0], scope);
		return val !== null && val !== undefined;
	}

	if ("matches" in rule) {
		const [exprNode, pattern] = rule.matches as [Parameters<typeof evalExpr>[0], string];
		const val = evalExpr(exprNode, scope);
		return new RegExp(pattern).test(String(val));
	}

	throw new Error(`evalPolicyRule: unrecognized rule shape: ${JSON.stringify(rule)}`);
}

// ─── Legacy async evaluator (old string-based policy DSL) ─────────────────────
// Kept for backward compat — new code should use evalPolicyRule above.

import { evalExpr as evalExprLegacy, type ExprEvalContext } from "./expr";
import type { PolicyRule as LegacyPolicyRule } from "./policy";

export async function evalPolicy(
	rule: LegacyPolicyRule,
	ctx: ExprEvalContext,
): Promise<boolean> {
	if ("all" in rule) {
		for (const r of rule.all) {
			if (!(await evalPolicy(r, ctx))) return false;
		}
		return true;
	}
	if ("any" in rule) {
		for (const r of rule.any) {
			if (await evalPolicy(r, ctx)) return true;
		}
		return false;
	}
	if ("not" in rule) return !(await evalPolicy(rule.not, ctx));

	if ("eq" in rule) {
		const [a, b] = await Promise.all([
			evalExprLegacy(rule.eq[0], ctx),
			evalExprLegacy(rule.eq[1], ctx),
		]);
		return Object.is(a, b);
	}
	if ("neq" in rule) {
		const [a, b] = await Promise.all([
			evalExprLegacy(rule.neq[0], ctx),
			evalExprLegacy(rule.neq[1], ctx),
		]);
		return !Object.is(a, b);
	}
	if ("in" in rule) {
		const needle = await evalExprLegacy(rule.in[0], ctx);
		const haystack = await Promise.all(rule.in[1].map((e) => evalExprLegacy(e, ctx)));
		return haystack.some((v) => Object.is(v, needle));
	}
	if ("exists" in rule) {
		const v = await evalExprLegacy(rule.exists, ctx);
		return v !== undefined && v !== null;
	}
	if ("matches" in rule) {
		const v = await evalExprLegacy(rule.matches[0], ctx);
		if (typeof v !== "string") return false;
		return new RegExp(rule.matches[1]).test(v);
	}

	const cmp = "gt" in rule ? "gt" : "gte" in rule ? "gte" : "lt" in rule ? "lt" : "lte";
	const pair = (rule as Record<string, [string, string]>)[cmp];
	if (!pair) return false;
	const [a, b] = await Promise.all([
		evalExprLegacy(pair[0], ctx),
		evalExprLegacy(pair[1], ctx),
	]);
	if (typeof a !== "number" || typeof b !== "number") return false;
	if (cmp === "gt") return a > b;
	if (cmp === "gte") return a >= b;
	if (cmp === "lt") return a < b;
	return a <= b;
}
