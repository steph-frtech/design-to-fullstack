// Policy DSL — expression-tree for authorization rules.
// Compilable to: in-process evaluator, Prisma where-clause, Postgres RLS (V2).

import { z } from "zod";
import { isValidExpr } from "./expr";

const exprSchema = z
	.string()
	.min(1)
	.refine((s) => isValidExpr(s).ok, "invalid JSONata expression");

// Recursive type — define manually since Zod has weak inference on z.lazy().
export type PolicyRule =
	| { all: PolicyRule[] }
	| { any: PolicyRule[] }
	| { not: PolicyRule }
	| { eq: [string, string] }
	| { neq: [string, string] }
	| { in: [string, string[]] }
	| { gt: [string, string] }
	| { gte: [string, string] }
	| { lt: [string, string] }
	| { lte: [string, string] }
	| { exists: string }
	| { matches: [string, string] };

export const policyRuleSchema: z.ZodType<PolicyRule> = z.lazy(() =>
	z.union([
		z.object({ all: z.array(policyRuleSchema) }),
		z.object({ any: z.array(policyRuleSchema) }),
		z.object({ not: policyRuleSchema }),
		z.object({ eq: z.tuple([exprSchema, exprSchema]) }),
		z.object({ neq: z.tuple([exprSchema, exprSchema]) }),
		z.object({ in: z.tuple([exprSchema, z.array(exprSchema)]) }),
		z.object({ gt: z.tuple([exprSchema, exprSchema]) }),
		z.object({ gte: z.tuple([exprSchema, exprSchema]) }),
		z.object({ lt: z.tuple([exprSchema, exprSchema]) }),
		z.object({ lte: z.tuple([exprSchema, exprSchema]) }),
		z.object({ exists: exprSchema }),
		z.object({ matches: z.tuple([exprSchema, z.string()]) }),
	]),
);

export function validatePolicyRule(
	value: unknown,
): { ok: true; data: PolicyRule } | { ok: false; errors: string[] } {
	const r = policyRuleSchema.safeParse(value);
	if (r.success) return { ok: true, data: r.data };
	return {
		ok: false,
		errors: r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
	};
}
