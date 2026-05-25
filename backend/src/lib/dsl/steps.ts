// Step DSL — typed shape for Operation.steps[].
// LLM declares behavior step-by-step; runtime compiles to code.
// Expressions are JSONata strings (see ./expr.ts).

import { z } from "zod";
import { isValidExpr } from "./expr";

const exprSchema = z
	.string()
	.min(1)
	.refine((s) => isValidExpr(s).ok, "invalid JSONata expression");

// Best-effort: $.<root>.<path> — full JSONata is allowed but we surface a
// gentle warning for steps that don't look like clean references.

const jsonSchemaSchema = z.record(z.unknown()); // intentionally permissive

export type OperationStep =
	| { kind: "validate"; schema: Record<string, unknown> }
	| { kind: "authorize"; policy: string }
	| { kind: "read"; entity: string; where: string; as: string }
	| {
			kind: "mutate";
			op: "create" | "update" | "delete" | "upsert";
			entity: string;
			data?: string;
			where?: string;
			as?: string;
		}
	| {
			kind: "callIntegration";
			integration: string;
			capability: string;
			input: string;
			as?: string;
		}
	| { kind: "emitEvent"; event: string; payload: string }
	| { kind: "branch"; if: string; then: OperationStep[]; else?: OperationStep[] }
	| { kind: "return"; value: string };

export const operationStepSchema: z.ZodType<OperationStep> = z.lazy(() =>
	z.discriminatedUnion("kind", [
		z.object({ kind: z.literal("validate"), schema: jsonSchemaSchema }),
		z.object({ kind: z.literal("authorize"), policy: z.string().min(1) }),
		z.object({
			kind: z.literal("read"),
			entity: z.string().min(1),
			where: exprSchema,
			as: z.string().min(1),
		}),
		z.object({
			kind: z.literal("mutate"),
			op: z.enum(["create", "update", "delete", "upsert"]),
			entity: z.string().min(1),
			data: exprSchema.optional(),
			where: exprSchema.optional(),
			as: z.string().min(1).optional(),
		}),
		z.object({
			kind: z.literal("callIntegration"),
			integration: z.string().min(1),
			capability: z.string().min(1),
			input: exprSchema,
			as: z.string().min(1).optional(),
		}),
		z.object({
			kind: z.literal("emitEvent"),
			event: z.string().min(1),
			payload: exprSchema,
		}),
		z.object({
			kind: z.literal("branch"),
			if: exprSchema,
			then: z.array(operationStepSchema),
			else: z.array(operationStepSchema).optional(),
		}),
		z.object({ kind: z.literal("return"), value: exprSchema }),
	]),
);

export const operationStepsSchema = z.array(operationStepSchema);

// Validate steps in the context of a project (known entities, policies, integrations).
export type OperationProjectContext = {
	entityNames: Set<string>;
	policyNames: Set<string>;
	integrationKeys: Map<string, Set<string>>; // key -> capabilities
};

export function validateOperationSteps(
	steps: unknown,
	ctx: OperationProjectContext,
): { ok: true; data: OperationStep[] } | { ok: false; errors: string[] } {
	const parsed = operationStepsSchema.safeParse(steps);
	if (!parsed.success) {
		return {
			ok: false,
			errors: parsed.error.issues.map(
				(i) => `${i.path.join(".")}: ${i.message}`,
			),
		};
	}
	const errs: string[] = [];
	const walk = (list: OperationStep[], path: string) => {
		list.forEach((step, i) => {
			const p = `${path}[${i}].${step.kind}`;
			if ((step.kind === "read" || step.kind === "mutate") && !ctx.entityNames.has(step.entity)) {
				errs.push(`${p}: unknown entity "${step.entity}"`);
			}
			if (step.kind === "authorize" && !ctx.policyNames.has(step.policy)) {
				errs.push(`${p}: unknown policy "${step.policy}"`);
			}
			if (step.kind === "callIntegration") {
				const caps = ctx.integrationKeys.get(step.integration);
				if (!caps) errs.push(`${p}: unknown integration "${step.integration}"`);
				else if (!caps.has(step.capability))
					errs.push(
						`${p}: integration "${step.integration}" does not expose capability "${step.capability}"`,
					);
			}
			if (step.kind === "branch") {
				walk(step.then, `${p}.then`);
				if (step.else) walk(step.else, `${p}.else`);
			}
		});
	};
	walk(parsed.data, "$");
	if (errs.length > 0) return { ok: false, errors: errs };
	return { ok: true, data: parsed.data };
}
