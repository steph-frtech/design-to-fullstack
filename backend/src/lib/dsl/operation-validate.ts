// Static validation for OperationBody.
// Validates Zod structure + semantic references (entity/policy/integration/event names)
// and propagates step aliases for Expr validation.

import { validateExpr } from "./expr-validate";
import {
	type OperationBody,
	type OperationStep,
	operationBodySchema,
	operationStepSchema,
} from "./operation-dsl";

// ─── Types ────────────────────────────────────────────────────────────────────

export type OperationValidateCtx = {
	entityNames: string[];
	policyNames: string[];
	integrationNames: string[];
	/** If provided, emitEvent.event must be in this list. */
	eventNames?: string[];
	/** If true, at least one top-level return (or return in every branch) is required. */
	expectedReturn?: boolean;
	/** JSON Schema for the operation input (unused in V1, reserved). */
	inputSchema?: unknown;
};

const ALIAS_RE = /^[a-z][a-zA-Z0-9_]*$/;

export type OperationError = { path: string; code: string; message: string };
export type OperationValidateResult = { ok: boolean; errors: OperationError[] };

// ─── Main entry ──────────────────────────────────────────────────────────────

export function validateOperationBody(
	steps: unknown,
	ctx: OperationValidateCtx,
): OperationValidateResult {
	const errors: OperationError[] = [];

	const parsed = operationBodySchema_safe(steps, errors);
	if (!parsed) return { ok: false, errors };

	validateSteps(parsed, "steps", ctx, [], errors);

	if (ctx.expectedReturn) {
		if (!hasReturn(parsed)) {
			errors.push({
				path: "steps",
				code: "missing_return",
				message: "expectedReturn is true but no top-level return step (or branch covering all paths) was found",
			});
		}
	}

	return { ok: errors.length === 0, errors };
}

// ─── Recursive step validation ────────────────────────────────────────────────

function validateSteps(
	steps: OperationBody,
	pathPrefix: string,
	ctx: OperationValidateCtx,
	inheritedAliases: string[],
	errors: OperationError[],
): string[] {
	// Returns all aliases collected in this list (for callers that need them)
	const aliases = [...inheritedAliases];

	for (let i = 0; i < steps.length; i++) {
		const step = steps[i];
		const path = `${pathPrefix}[${i}]`;

		// Zod-validate each step individually for a precise path in the error
		const stepParsed = operationStepSchema.safeParse(step);
		if (!stepParsed.success) {
			for (const issue of stepParsed.error.issues) {
				errors.push({
					path: `${path}.${issue.path.join(".")}`,
					code: "zod_parse",
					message: issue.message,
				});
			}
			continue; // can't do semantic checks on malformed step
		}

		validateStep(stepParsed.data, path, ctx, aliases, errors);

		// Collect alias AFTER validating the step, so later steps can reference it
		const alias = getStepAlias(stepParsed.data);
		if (alias && !aliases.includes(alias)) {
			aliases.push(alias);
		}
	}

	return aliases;
}

function validateStep(
	step: OperationStep,
	path: string,
	ctx: OperationValidateCtx,
	aliases: string[],
	errors: OperationError[],
): void {
	const exprCtx = { availableStepAliases: aliases };

	switch (step.kind) {
		case "validate":
			// schema is a JSON Schema — no further validation in V1
			break;

		case "authorize":
			if (!ctx.policyNames.includes(step.policy)) {
				errors.push({
					path: `${path}.policy`,
					code: "unknown_policy",
					message: `policy "${step.policy}" not found in project (known: ${ctx.policyNames.join(", ") || "none"})`,
				});
			}
			break;

		case "read":
			if (!ctx.entityNames.includes(step.entity)) {
				errors.push({
					path: `${path}.entity`,
					code: "unknown_entity",
					message: `entity "${step.entity}" not found in project (known: ${ctx.entityNames.join(", ") || "none"})`,
				});
			}
			if (step.where !== undefined) {
				pushExprErrors(validateExpr(step.where, exprCtx), `${path}.where`, errors);
			}
			validateAlias(step.as, `${path}.as`, errors);
			break;

		case "mutate":
			if (!ctx.entityNames.includes(step.entity)) {
				errors.push({
					path: `${path}.entity`,
					code: "unknown_entity",
					message: `entity "${step.entity}" not found in project (known: ${ctx.entityNames.join(", ") || "none"})`,
				});
			}
			// op-specific field requirements
			if (step.op === "create" && step.data === undefined) {
				errors.push({
					path: `${path}.data`,
					code: "missing_field",
					message: 'mutate op:"create" requires a "data" Expr',
				});
			}
			if (step.op === "update" && step.data === undefined) {
				errors.push({
					path: `${path}.data`,
					code: "missing_field",
					message: 'mutate op:"update" requires a "data" Expr',
				});
			}
			if ((step.op === "update" || step.op === "delete") && step.where === undefined) {
				errors.push({
					path: `${path}.where`,
					code: "missing_field",
					message: `mutate op:"${step.op}" requires a "where" Expr`,
				});
			}
			if (step.data !== undefined) {
				pushExprErrors(validateExpr(step.data, exprCtx), `${path}.data`, errors);
			}
			if (step.where !== undefined) {
				pushExprErrors(validateExpr(step.where, exprCtx), `${path}.where`, errors);
			}
			if (step.as !== undefined) validateAlias(step.as, `${path}.as`, errors);
			break;

		case "callIntegration":
			if (!ctx.integrationNames.includes(step.integration)) {
				errors.push({
					path: `${path}.integration`,
					code: "unknown_integration",
					message: `integration "${step.integration}" not found in project (known: ${ctx.integrationNames.join(", ") || "none"})`,
				});
			}
			pushExprErrors(validateExpr(step.input, exprCtx), `${path}.input`, errors);
			if (step.as !== undefined) validateAlias(step.as, `${path}.as`, errors);
			break;

		case "emitEvent":
			if (ctx.eventNames !== undefined && !ctx.eventNames.includes(step.event)) {
				errors.push({
					path: `${path}.event`,
					code: "unknown_event",
					message: `event "${step.event}" not found in project (known: ${ctx.eventNames.join(", ") || "none"})`,
				});
			}
			pushExprErrors(validateExpr(step.payload, exprCtx), `${path}.payload`, errors);
			break;

		case "branch":
			pushExprErrors(validateExpr(step.if, exprCtx), `${path}.if`, errors);
			// then/else branches share the same alias scope (aliases defined in
			// then/else become visible after the branch step)
			const thenAliases = validateSteps(step.then, `${path}.then`, ctx, aliases, errors);
			if (step.else) {
				const elseAliases = validateSteps(step.else, `${path}.else`, ctx, aliases, errors);
				// Merge aliases from both branches into the parent for subsequent steps
				for (const a of [...thenAliases, ...elseAliases]) {
					if (!aliases.includes(a)) aliases.push(a);
				}
			} else {
				for (const a of thenAliases) {
					if (!aliases.includes(a)) aliases.push(a);
				}
			}
			break;

		case "assert":
			pushExprErrors(validateExpr(step.condition, exprCtx), `${path}.condition`, errors);
			break;

		case "log":
			pushExprErrors(validateExpr(step.message, exprCtx), `${path}.message`, errors);
			break;

		case "return":
			pushExprErrors(validateExpr(step.value, exprCtx), `${path}.value`, errors);
			break;
	}
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function operationBodySchema_safe(
	steps: unknown,
	errors: OperationError[],
): OperationBody | null {
	const parsed = operationBodySchema.safeParse(steps);
	if (!parsed.success) {
		for (const issue of parsed.error.issues) {
			errors.push({
				path: issue.path.join("."),
				code: "zod_parse",
				message: issue.message,
			});
		}
		return null;
	}
	return parsed.data;
}

function getStepAlias(step: OperationStep): string | undefined {
	if (step.kind === "read") return step.as;
	if (step.kind === "mutate") return step.as;
	if (step.kind === "callIntegration") return step.as;
	return undefined;
}

function pushExprErrors(
	result: { ok: boolean; errors: { path: string; code: string; message: string }[] },
	prefix: string,
	out: OperationError[],
): void {
	for (const e of result.errors) {
		out.push({
			path: e.path ? `${prefix}.${e.path}` : prefix,
			code: e.code,
			message: e.message,
		});
	}
}

function validateAlias(alias: string, path: string, errors: OperationError[]): void {
	if (!ALIAS_RE.test(alias)) {
		errors.push({
			path,
			code: "invalid_alias",
			message: `"as" identifier must match /^[a-z][a-zA-Z0-9_]*$/ — got "${alias}"`,
		});
	}
}

/**
 * Returns true if the step list contains a top-level `return`, OR if it ends
 * with a `branch` that has a `return` in every branch (then + else).
 */
function hasReturn(steps: OperationBody): boolean {
	for (const step of steps) {
		if (step.kind === "return") return true;
	}
	// Check if the last step is a branch where both paths return
	const last = steps[steps.length - 1];
	if (last && last.kind === "branch" && last.else) {
		return hasReturn(last.then) && hasReturn(last.else);
	}
	return false;
}

