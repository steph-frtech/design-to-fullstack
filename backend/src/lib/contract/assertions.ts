// Contract assertion helpers for pipeline validation.
// All assertions are synchronous pure checks except assertCoverageContract which
// queries the DB.
//
// Usage:
//   const r = assertDeltaSpecContract(deltaSpec, ctx);
//   if (!r.ok) throw new Error(r.violations.map(v => v.message).join("\n"));

import { validateDeltaSpec, type DeltaSpecValidationCtx } from "../delta-spec-validation";
import { EXPR_FUNCTIONS } from "../dsl/expr-ast";
import { collectExprCalls } from "../dsl/expr-analyze";
import type { DeltaSpec } from "../dsl/delta-spec";

export type Violation = {
	code: string;
	message: string;
};

export type ContractResult = {
	ok: boolean;
	violations: Violation[];
};

// ─── assertDeltaSpecContract ──────────────────────────────────────────────────

export type DeltaSpecContractCtx = DeltaSpecValidationCtx;

/**
 * Structural + semantic contract check for a DeltaSpec.
 *
 * Checks:
 * 1. JSON parseable (input must be an object, not a string)
 * 2. Zod valid (via validateDeltaSpec)
 * 3. No unknown Expr function calls in operation steps
 * 4. No entity cross-ref errors (via validateDeltaSpec)
 * 5. No policy without entityName when scope=ENTITY (orphan policy check)
 * 6. No operation missing a return step when kind=QUERY
 */
export function assertDeltaSpecContract(
	deltaSpec: unknown,
	ctx: DeltaSpecContractCtx,
): ContractResult {
	const violations: Violation[] = [];

	// 1. Must be a plain object (not null, not array, not string)
	if (!deltaSpec || typeof deltaSpec !== "object" || Array.isArray(deltaSpec)) {
		violations.push({
			code: "invalid_json_structure",
			message: "DeltaSpec must be a non-null plain object",
		});
		return { ok: false, violations };
	}

	// 2. Zod + cross-ref validation
	const validResult = validateDeltaSpec(deltaSpec, ctx);
	if (!validResult.ok) {
		for (const err of validResult.errors) {
			violations.push({ code: err.code, message: `[${err.path}] ${err.message}` });
		}
	}

	const ds = deltaSpec as DeltaSpec;

	// 3. No unknown Expr function calls in operation steps
	const knownFunctions = new Set(Object.keys(EXPR_FUNCTIONS));
	for (const op of ds.operations?.create ?? []) {
		for (const step of op.steps ?? []) {
			if (!step || typeof step !== "object") continue;
			// Steps may embed Expr in fields like `value`, `data`, `condition`, etc.
			const stepObj = step as Record<string, unknown>;
			for (const val of Object.values(stepObj)) {
				if (!val || typeof val !== "object") continue;
				try {
					// biome-ignore lint/suspicious/noExplicitAny: dynamic step traversal
					const calls = collectExprCalls(val as any);
					for (const call of calls) {
						if (!knownFunctions.has(call)) {
							violations.push({
								code: "unknown_expr_function",
								message: `Operation "${op.name}" references unknown Expr function "${call}"`,
							});
						}
					}
				} catch {
					// not an Expr node — skip
				}
			}
		}
	}

	// 4. Orphan policy: scope=ENTITY but no entityName/entityId
	for (const pol of ds.policies?.create ?? []) {
		if (pol.scope === "ENTITY" && !pol.entityName && !pol.entityId) {
			violations.push({
				code: "orphan_policy",
				message: `Policy "${pol.name}" has scope=ENTITY but neither entityName nor entityId is set`,
			});
		}
	}

	// 5. Operation without return: QUERY kind must have at least one return step
	for (const op of ds.operations?.create ?? []) {
		if (op.kind === "QUERY") {
			const hasReturn = (op.steps ?? []).some(
				(s) => s && typeof s === "object" && (s as Record<string, unknown>).kind === "return",
			);
			if (!hasReturn) {
				violations.push({
					code: "missing_return",
					message: `QUERY operation "${op.name}" has no return step`,
				});
			}
		}
	}

	return { ok: violations.length === 0, violations };
}

// ─── assertCoverageContract ───────────────────────────────────────────────────

/**
 * Check that no MUST/HIGH/CRITICAL Requirement is uncovered.
 * Requires a live DB connection (imports coverage-gate which imports prisma).
 * Returns { ok, violations } — each violation is a blocked requirement.
 */
export async function assertCoverageContract(projectId: string): Promise<ContractResult> {
	const { checkCoverageGate } = await import("../coverage-gate");
	const result = await checkCoverageGate(projectId);
	const violations: Violation[] = result.entries
		.filter((e) => e.blocked)
		.map((e) => ({
			code: "uncovered_requirement",
			message: `Requirement "${e.key}" (${e.priority ?? e.status}) has 0 mappings`,
		}));
	return { ok: !result.blocked, violations };
}
