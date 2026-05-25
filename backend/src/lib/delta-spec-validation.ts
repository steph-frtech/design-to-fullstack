// Static (no-DB-write) validation of a DeltaSpec.
//
// Returns { ok, errors } — errors carry code + path + message.
// Cross-ref checks: entity names must resolve to either an existing entity or
// a create in the same DeltaSpec. Same for operations.

import { deltaSpecSchema, type DeltaSpec } from "./dsl/delta-spec";

export type DeltaSpecError = {
	code: string;
	path: string;
	message: string;
};

export type DeltaSpecValidationCtx = {
	existingEntityNames: Set<string>;
	existingOperationNames: Set<string>;
};

export type DeltaSpecValidationResult = {
	ok: boolean;
	errors: DeltaSpecError[];
};

export function validateDeltaSpec(
	deltaSpec: unknown,
	ctx: DeltaSpecValidationCtx,
): DeltaSpecValidationResult {
	const errors: DeltaSpecError[] = [];

	// ─── 1. Zod structural parse ──────────────────────────────────────
	const parsed = deltaSpecSchema.safeParse(deltaSpec);
	if (!parsed.success) {
		for (const issue of parsed.error.issues) {
			errors.push({
				code: "zod_error",
				path: issue.path.join("."),
				message: issue.message,
			});
		}
		return { ok: false, errors };
	}

	const ds: DeltaSpec = parsed.data;

	// ─── Build local name sets from creates ──────────────────────────
	const newEntityNames = new Set<string>(
		(ds.entities?.create ?? []).map((e) => e.name),
	);
	const allEntityNames = new Set([...ctx.existingEntityNames, ...newEntityNames]);

	const newOperationNames = new Set<string>(
		(ds.operations?.create ?? []).map((o) => o.name),
	);
	const allOperationNames = new Set([...ctx.existingOperationNames, ...newOperationNames]);

	// ─── 2. Attribute.entityName cross-ref ───────────────────────────
	const attrCreates = ds.attributes?.create ?? [];
	for (let i = 0; i < attrCreates.length; i++) {
		const attr = attrCreates[i];
		if (attr && attr.entityName && !allEntityNames.has(attr.entityName)) {
			errors.push({
				code: "unresolved_entity_ref",
				path: `attributes.create[${i}].entityName`,
				message: `Entity "${attr.entityName}" does not exist and is not in this DeltaSpec's creates.`,
			});
		}
	}

	// ─── 3. Relation entity refs ──────────────────────────────────────
	const relCreates = ds.relations?.create ?? [];
	for (let i = 0; i < relCreates.length; i++) {
		const rel = relCreates[i];
		if (!rel) continue;
		if (rel.fromEntityName && !allEntityNames.has(rel.fromEntityName)) {
			errors.push({
				code: "unresolved_entity_ref",
				path: `relations.create[${i}].fromEntityName`,
				message: `Entity "${rel.fromEntityName}" not found.`,
			});
		}
		if (rel.toEntityName && !allEntityNames.has(rel.toEntityName)) {
			errors.push({
				code: "unresolved_entity_ref",
				path: `relations.create[${i}].toEntityName`,
				message: `Entity "${rel.toEntityName}" not found.`,
			});
		}
	}

	// ─── 4. Resource.entityName cross-ref ────────────────────────────
	const resCreates = ds.resources?.create ?? [];
	for (let i = 0; i < resCreates.length; i++) {
		const res = resCreates[i];
		if (res && res.entityName && !allEntityNames.has(res.entityName)) {
			errors.push({
				code: "unresolved_entity_ref",
				path: `resources.create[${i}].entityName`,
				message: `Entity "${res.entityName}" not found.`,
			});
		}
	}

	// ─── 5. Policy.entityName cross-ref ──────────────────────────────
	const polCreates = ds.policies?.create ?? [];
	for (let i = 0; i < polCreates.length; i++) {
		const pol = polCreates[i];
		if (pol && pol.entityName && !allEntityNames.has(pol.entityName)) {
			errors.push({
				code: "unresolved_entity_ref",
				path: `policies.create[${i}].entityName`,
				message: `Entity "${pol.entityName}" not found.`,
			});
		}
	}

	// ─── 6. Operation reads/writes cross-ref ─────────────────────────
	const opCreates = ds.operations?.create ?? [];
	for (let i = 0; i < opCreates.length; i++) {
		const op = opCreates[i];
		if (!op) continue;
		for (const name of op.reads ?? []) {
			if (!allEntityNames.has(name)) {
				errors.push({
					code: "unresolved_entity_ref",
					path: `operations.create[${i}].reads`,
					message: `Entity "${name}" listed in reads not found.`,
				});
			}
		}
		for (const name of op.writes ?? []) {
			if (!allEntityNames.has(name)) {
				errors.push({
					code: "unresolved_entity_ref",
					path: `operations.create[${i}].writes`,
					message: `Entity "${name}" listed in writes not found.`,
				});
			}
		}
	}

	// ─── 7. Trigger.operationName cross-ref ──────────────────────────
	const trigCreates = ds.triggers?.create ?? [];
	for (let i = 0; i < trigCreates.length; i++) {
		const t = trigCreates[i];
		if (t && t.operationName && !allOperationNames.has(t.operationName)) {
			errors.push({
				code: "unresolved_operation_ref",
				path: `triggers.create[${i}].operationName`,
				message: `Operation "${t.operationName}" not found.`,
			});
		}
	}

	return { ok: errors.length === 0, errors };
}
