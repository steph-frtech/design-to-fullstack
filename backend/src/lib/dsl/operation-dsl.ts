// Typed AST for the Operation Step DSL.
// Operation.kind = QUERY | COMMAND (WORKFLOW is reserved for V3+).
// This file contains only types and schemas — no runtime logic.

import { z } from "zod";
import { exprSchema } from "./expr-ast";

// ─── Type definition ──────────────────────────────────────────────────────────

export type OperationStep =
	| { kind: "validate"; schema?: unknown }
	| { kind: "authorize"; policy: string }
	| { kind: "read"; entity: string; where?: unknown; many?: boolean; as: string }
	| {
			kind: "mutate";
			op: "create" | "update" | "delete";
			entity: string;
			data?: unknown;
			where?: unknown;
			as?: string;
	  }
	| { kind: "callIntegration"; integration: string; capability: string; input: unknown; as?: string }
	| { kind: "emitEvent"; event: string; payload: unknown }
	| { kind: "branch"; if: unknown; then: OperationStep[]; else?: OperationStep[] }
	| { kind: "assert"; condition: unknown; message: string }
	| { kind: "log"; level: "info" | "warn" | "error"; message: unknown }
	| { kind: "return"; value: unknown };

// ─── Zod schema (recursive via z.lazy) ───────────────────────────────────────

// biome-ignore lint/suspicious/noExplicitAny: intentional recursive lazy
const _operationStepSchemaInner: z.ZodType<OperationStep> = z.lazy(() =>
	z.discriminatedUnion("kind", [
		z.object({
			kind: z.literal("validate"),
			// z.unknown() makes the field appear optional in TS inference;
			// z.any() treats it as required. We want required.
			schema: z.any(),
		}),
		z.object({
			kind: z.literal("authorize"),
			policy: z.string().min(1),
		}),
		z.object({
			kind: z.literal("read"),
			entity: z.string().min(1),
			where: exprSchema.optional(),
			many: z.boolean().optional(),
			as: z.string().min(1),
		}),
		z.object({
			kind: z.literal("mutate"),
			op: z.enum(["create", "update", "delete"]),
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
			then: z.array(_operationStepSchemaInner),
			else: z.array(_operationStepSchemaInner).optional(),
		}),
		z.object({
			kind: z.literal("assert"),
			condition: exprSchema,
			message: z.string().min(1),
		}),
		z.object({
			kind: z.literal("log"),
			level: z.enum(["info", "warn", "error"]),
			message: exprSchema,
		}),
		z.object({
			kind: z.literal("return"),
			value: exprSchema,
		}),
	]),
);

// Cast to the declared type so callers get proper TS typing.
export const operationStepSchema: z.ZodType<OperationStep> =
	_operationStepSchemaInner as z.ZodType<OperationStep>;

export type OperationBody = OperationStep[];

export const operationBodySchema: z.ZodType<OperationBody> = z.array(operationStepSchema);

export const OPERATION_STEP_KINDS = [
	"validate",
	"authorize",
	"read",
	"mutate",
	"callIntegration",
	"emitEvent",
	"branch",
	"assert",
	"log",
	"return",
] as const;

export type OperationStepKind = (typeof OPERATION_STEP_KINDS)[number];
