// Typed AST for the Policy Rule DSL.
// PolicyRule is a recursive expression tree — all/any/not are combinators,
// the rest are leaf comparisons.

import { z } from "zod";
import { exprSchema } from "./expr-ast";

// ─── Type definition ──────────────────────────────────────────────────────────

export type PolicyRule =
	| { all: PolicyRule[] }
	| { any: PolicyRule[] }
	| { not: PolicyRule }
	| { eq: [unknown, unknown] }
	| { neq: [unknown, unknown] }
	| { in: [unknown, unknown] }
	| { gt: [unknown, unknown] }
	| { gte: [unknown, unknown] }
	| { lt: [unknown, unknown] }
	| { lte: [unknown, unknown] }
	| { exists: unknown }
	| { matches: [unknown, string] };

// ─── Zod schema (recursive via z.lazy) ───────────────────────────────────────

const exprTuple = z.tuple([exprSchema, exprSchema]);

// biome-ignore lint/suspicious/noExplicitAny: intentional recursive lazy
export const policyRuleSchema: z.ZodType<PolicyRule> = z.lazy(() =>
	z.union([
		z.object({ all: z.array(policyRuleSchema) }),
		z.object({ any: z.array(policyRuleSchema) }),
		z.object({ not: policyRuleSchema }),
		z.object({ eq: exprTuple }),
		z.object({ neq: exprTuple }),
		z.object({ in: exprTuple }),
		z.object({ gt: exprTuple }),
		z.object({ gte: exprTuple }),
		z.object({ lt: exprTuple }),
		z.object({ lte: exprTuple }),
		z.object({ exists: exprSchema }),
		z.object({ matches: z.tuple([exprSchema, z.string()]) }),
	]),
);

export const POLICY_RULE_OPS = [
	"all",
	"any",
	"not",
	"eq",
	"neq",
	"in",
	"gt",
	"gte",
	"lt",
	"lte",
	"exists",
	"matches",
] as const;

export type PolicyRuleOp = (typeof POLICY_RULE_OPS)[number];
