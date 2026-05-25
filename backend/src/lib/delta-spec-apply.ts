// Apply a DeltaSpec to the database within an active ChangeSet context.
// Executes in dependency order (entities → attributes → relations → … → screens).
// Does NOT wrap in a single Prisma transaction — the ChangeSet middleware
// handles grouping. Partial failures return { ok: false } and discard the CS.
//
// NOTE: ChangeSetStatus has no FAILED value (DRAFT|APPLIED|REVERTED only).
// On error the ChangeSet is deleted (DISCARDED behaviour) and a gap note is
// left here until a migration adds FAILED. See docs/CHANGESET_AUDIT.md §4.

import type { ExtendedPrismaClient } from "../versioning";
import { runInChangeSet } from "./changeset-context";
import type { DeltaSpec } from "./dsl/delta-spec";

// All update items in DeltaSpec carry { id: string } plus optional patch fields.
// The Zod inference collapses to `{}` in some cases — this cast makes it explicit.
type WithId = { id: string } & Record<string, unknown>;

export type ApplyCtx = {
	projectId: string;
	changeSetId: string;
	dryRun?: boolean;
};

export type ApplyError = {
	path: string;
	code: string;
	message: string;
};

export type ApplyResult = {
	ok: boolean;
	appliedCount: number;
	/** createdIds["Entity"]["Contact"] = "ent_xyz" for name-resolution across buckets */
	createdIds: Record<string, Record<string, string>>;
	errors?: ApplyError[];
};

// ─── Helper: model delegate ──────────────────────────────────────────────────

// biome-ignore lint/suspicious/noExplicitAny: dynamic model access
type AnyDelegate = any;

function delegate(prisma: ExtendedPrismaClient, model: string): AnyDelegate {
	const key = model.charAt(0).toLowerCase() + model.slice(1);
	// biome-ignore lint/suspicious/noExplicitAny: dynamic access
	const d = (prisma as unknown as Record<string, any>)[key];
	if (!d) throw new Error(`No Prisma delegate for model ${model}`);
	return d;
}

// ─── Name-ref resolution ────────────────────────────────────────────────────

async function resolveEntityId(
	prisma: ExtendedPrismaClient,
	projectId: string,
	createdIds: Record<string, Record<string, string>>,
	nameOrId: { entityName?: string; entityId?: string },
): Promise<string | undefined> {
	if (nameOrId.entityId) return nameOrId.entityId;
	if (!nameOrId.entityName) return undefined;
	// 1. Check what we just created in this DeltaSpec
	const local = createdIds["Entity"]?.[nameOrId.entityName];
	if (local) return local;
	// 2. DB lookup
	const row = await delegate(prisma, "Entity").findUnique({
		where: { projectId_name: { projectId, name: nameOrId.entityName } },
		select: { id: true },
	});
	return row?.id;
}

async function resolveOperationId(
	prisma: ExtendedPrismaClient,
	projectId: string,
	createdIds: Record<string, Record<string, string>>,
	nameOrId: { operationName?: string; operationId?: string },
): Promise<string | undefined> {
	if (nameOrId.operationId) return nameOrId.operationId;
	if (!nameOrId.operationName) return undefined;
	const local = createdIds["Operation"]?.[nameOrId.operationName];
	if (local) return local;
	const row = await delegate(prisma, "Operation").findUnique({
		where: { projectId_name: { projectId, name: nameOrId.operationName } },
		select: { id: true },
	});
	return row?.id;
}

// ─── Main apply function ─────────────────────────────────────────────────────

export async function applyDeltaSpec(
	prisma: ExtendedPrismaClient,
	deltaSpec: DeltaSpec,
	ctx: ApplyCtx,
): Promise<ApplyResult> {
	if (ctx.dryRun) {
		return { ok: true, appliedCount: 0, createdIds: {} };
	}

	const { projectId, changeSetId } = ctx;
	const createdIds: Record<string, Record<string, string>> = {};
	const errors: ApplyError[] = [];
	let appliedCount = 0;

	function trackCreated(model: string, name: string, id: string) {
		if (!createdIds[model]) createdIds[model] = {};
		createdIds[model][name] = id;
	}

	// biome-ignore lint/suspicious/noExplicitAny: generic helper, typed via caller
	async function run(
		path: string,
		fn: () => Promise<any>,
	): Promise<Record<string, unknown> | null> {
		try {
			return await fn();
		} catch (err) {
			errors.push({
				path,
				code: "apply_error",
				message: (err as Error).message,
			});
			return null;
		}
	}

	// Run everything inside the ChangeSet ALS context so the versioning
	// extension links each Revision to this ChangeSet automatically.
	await runInChangeSet({ changeSetId, projectId, origin: "explicit" }, async () => {

		// ── 1. ProductSpecs ─────────────────────────────────────────────
		for (const [i, item] of (deltaSpec.productSpecs?.create ?? []).entries()) {
			const row = await run(`productSpecs.create[${i}]`, () =>
				delegate(prisma, "ProductSpec").create({
					data: {
						projectId,
						title: item.title,
						description: item.description,
						domain: item.domain,
						targetUsers: (item.targetUsers ?? []) as never,
						goals: (item.goals ?? []) as never,
						nonGoals: (item.nonGoals ?? undefined) as never,
						personas: (item.personas ?? undefined) as never,
						userJourneys: (item.userJourneys ?? undefined) as never,
						businessObjects: (item.businessObjects ?? undefined) as never,
						businessRules: (item.businessRules ?? undefined) as never,
						glossary: (item.glossary ?? undefined) as never,
						assumptions: (item.assumptions ?? undefined) as never,
						openQuestions: (item.openQuestions ?? undefined) as never,
					},
				}),
			);
			if (row) { trackCreated("ProductSpec", item.title, row.id as string); appliedCount++; }
		}
		for (const [i, item] of (deltaSpec.productSpecs?.update ?? []).entries()) {
			const { id, ...patch } = item as WithId;
			const row = await run(`productSpecs.update[${i}]`, () =>
				delegate(prisma, "ProductSpec").update({ where: { id }, data: patch as never }),
			);
			if (row) appliedCount++;
		}

		// ── 2. ScreenSpecs ──────────────────────────────────────────────
		for (const [i, item] of (deltaSpec.screenSpecs?.create ?? []).entries()) {
			const row = await run(`screenSpecs.create[${i}]`, () =>
				delegate(prisma, "ScreenSpec").create({
					data: { projectId, ...item } as never,
				}),
			);
			if (row) { trackCreated("ScreenSpec", item.name, row.id as string); appliedCount++; }
		}
		for (const [i, item] of (deltaSpec.screenSpecs?.update ?? []).entries()) {
			const { id, ...patch } = item as WithId;
			const row = await run(`screenSpecs.update[${i}]`, () =>
				delegate(prisma, "ScreenSpec").update({ where: { id }, data: patch as never }),
			);
			if (row) appliedCount++;
		}

		// ── 3. Requirements ─────────────────────────────────────────────
		for (const [i, item] of (deltaSpec.requirements?.create ?? []).entries()) {
			const row = await run(`requirements.create[${i}]`, () =>
				delegate(prisma, "Requirement").create({
					data: { projectId, ...item } as never,
				}),
			);
			if (row) { trackCreated("Requirement", item.key, row.id as string); appliedCount++; }
		}
		for (const [i, item] of (deltaSpec.requirements?.update ?? []).entries()) {
			const { id, ...patch } = item as WithId;
			const row = await run(`requirements.update[${i}]`, () =>
				delegate(prisma, "Requirement").update({ where: { id }, data: patch as never }),
			);
			if (row) appliedCount++;
		}

		// ── 4. Entities ─────────────────────────────────────────────────
		for (const [i, item] of (deltaSpec.entities?.create ?? []).entries()) {
			const row = await run(`entities.create[${i}]`, () =>
				delegate(prisma, "Entity").create({
					data: { projectId, name: item.name, nameKey: item.nameKey },
				}),
			);
			if (row) { trackCreated("Entity", item.name, row.id as string); appliedCount++; }
		}
		for (const [i, item] of (deltaSpec.entities?.update ?? []).entries()) {
			const { id, ...patch } = item as WithId;
			const row = await run(`entities.update[${i}]`, () =>
				delegate(prisma, "Entity").update({ where: { id }, data: patch }),
			);
			if (row) appliedCount++;
		}

		// ── 5. Attributes ───────────────────────────────────────────────
		for (const [i, item] of (deltaSpec.attributes?.create ?? []).entries()) {
			const entityId = await resolveEntityId(prisma, projectId, createdIds, {
				entityName: item.entityName,
				entityId: item.entityId,
			});
			if (!entityId) {
				errors.push({
					path: `attributes.create[${i}].entityName`,
					code: "unresolved_entity_ref",
					message: `Entity "${item.entityName ?? item.entityId}" not found`,
				});
				continue;
			}
			const row = await run(`attributes.create[${i}]`, () =>
				delegate(prisma, "Attribute").create({
					data: {
						entityId,
						name: item.name,
						type: item.type as never,
						required: item.required ?? false,
						unique: item.unique ?? false,
						config: (item.config ?? {}) as never,
					},
				}),
			);
			if (row) { trackCreated("Attribute", `${entityId}:${item.name}`, row.id as string); appliedCount++; }
		}
		for (const [i, item] of (deltaSpec.attributes?.update ?? []).entries()) {
			const { id, ...patch } = item as WithId;
			const row = await run(`attributes.update[${i}]`, () =>
				delegate(prisma, "Attribute").update({ where: { id }, data: patch as never }),
			);
			if (row) appliedCount++;
		}

		// ── 6. Relations ────────────────────────────────────────────────
		for (const [i, item] of (deltaSpec.relations?.create ?? []).entries()) {
			const fromEntityId = await resolveEntityId(prisma, projectId, createdIds, {
				entityName: item.fromEntityName,
				entityId: item.fromEntityId,
			});
			const toEntityId = await resolveEntityId(prisma, projectId, createdIds, {
				entityName: item.toEntityName,
				entityId: item.toEntityId,
			});
			if (!fromEntityId || !toEntityId) {
				errors.push({
					path: `relations.create[${i}]`,
					code: "unresolved_entity_ref",
					message: `fromEntity or toEntity not found for relation "${item.name}"`,
				});
				continue;
			}
			const row = await run(`relations.create[${i}]`, () =>
				delegate(prisma, "EntityRelation").create({
					data: {
						projectId,
						fromEntityId,
						toEntityId,
						name: item.name,
						kind: item.kind as never,
						fromField: item.fromField,
						toField: item.toField,
						required: item.required ?? false,
						cascade: (item.cascade ?? undefined) as never,
					},
				}),
			);
			if (row) { trackCreated("EntityRelation", item.name, row.id as string); appliedCount++; }
		}
		for (const [i, item] of (deltaSpec.relations?.update ?? []).entries()) {
			const { id, ...patch } = item as WithId;
			const row = await run(`relations.update[${i}]`, () =>
				delegate(prisma, "EntityRelation").update({ where: { id }, data: patch as never }),
			);
			if (row) appliedCount++;
		}

		// ── 7. Policies ─────────────────────────────────────────────────
		for (const [i, item] of (deltaSpec.policies?.create ?? []).entries()) {
			const entityId = item.entityName || item.entityId
				? await resolveEntityId(prisma, projectId, createdIds, {
						entityName: item.entityName,
						entityId: item.entityId,
					})
				: undefined;
			const row = await run(`policies.create[${i}]`, () =>
				delegate(prisma, "Policy").create({
					data: {
						projectId,
						name: item.name,
						scope: item.scope as never,
						entityId: entityId ?? null,
						fieldName: item.fieldName,
						effect: (item.effect ?? "ALLOW") as never,
						rule: item.rule as never,
					},
				}),
			);
			if (row) { trackCreated("Policy", item.name, row.id as string); appliedCount++; }
		}
		for (const [i, item] of (deltaSpec.policies?.update ?? []).entries()) {
			const { id, ...patch } = item as WithId;
			const row = await run(`policies.update[${i}]`, () =>
				delegate(prisma, "Policy").update({ where: { id }, data: patch as never }),
			);
			if (row) appliedCount++;
		}

		// ── 8. Integrations ─────────────────────────────────────────────
		for (const [i, item] of (deltaSpec.integrations?.create ?? []).entries()) {
			const row = await run(`integrations.create[${i}]`, () =>
				delegate(prisma, "Integration").create({
					data: {
						projectId,
						key: item.key,
						provider: item.provider,
						capabilities: item.capabilities as never,
						configSchema: (item.configSchema ?? {}) as never,
						secretRefs: (item.secretRefs ?? undefined) as never,
					},
				}),
			);
			if (row) { trackCreated("Integration", item.key, row.id as string); appliedCount++; }
		}
		for (const [i, item] of (deltaSpec.integrations?.update ?? []).entries()) {
			const { id, ...patch } = item as WithId;
			const row = await run(`integrations.update[${i}]`, () =>
				delegate(prisma, "Integration").update({ where: { id }, data: patch as never }),
			);
			if (row) appliedCount++;
		}

		// ── 9. Operations ───────────────────────────────────────────────
		for (const [i, item] of (deltaSpec.operations?.create ?? []).entries()) {
			const row = await run(`operations.create[${i}]`, () =>
				delegate(prisma, "Operation").create({
					data: {
						projectId,
						name: item.name,
						kind: item.kind as never,
						inputSchema: item.inputSchema as never,
						outputSchema: (item.outputSchema ?? undefined) as never,
						reads: (item.reads ?? []) as never,
						writes: (item.writes ?? []) as never,
						steps: item.steps as never,
						bodyHint: item.bodyHint,
					},
				}),
			);
			if (row) { trackCreated("Operation", item.name, row.id as string); appliedCount++; }
		}
		for (const [i, item] of (deltaSpec.operations?.update ?? []).entries()) {
			const { id, ...patch } = item as WithId;
			const row = await run(`operations.update[${i}]`, () =>
				delegate(prisma, "Operation").update({ where: { id }, data: patch as never }),
			);
			if (row) appliedCount++;
		}

		// ── 10. Resources ───────────────────────────────────────────────
		for (const [i, item] of (deltaSpec.resources?.create ?? []).entries()) {
			const entityId = await resolveEntityId(prisma, projectId, createdIds, {
				entityName: item.entityName,
				entityId: item.entityId,
			});
			if (!entityId) {
				errors.push({
					path: `resources.create[${i}].entityName`,
					code: "unresolved_entity_ref",
					message: `Entity "${item.entityName ?? item.entityId}" not found for resource "${item.name}"`,
				});
				continue;
			}
			const row = await run(`resources.create[${i}]`, () =>
				delegate(prisma, "Resource").create({
					data: {
						projectId,
						entityId,
						name: item.name,
						exposedOps: item.exposedOps as never,
						queryConfig: (item.queryConfig ?? undefined) as never,
					},
				}),
			);
			if (row) { trackCreated("Resource", item.name, row.id as string); appliedCount++; }
		}
		for (const [i, item] of (deltaSpec.resources?.update ?? []).entries()) {
			const { id, ...patch } = item as WithId;
			const row = await run(`resources.update[${i}]`, () =>
				delegate(prisma, "Resource").update({ where: { id }, data: patch as never }),
			);
			if (row) appliedCount++;
		}

		// ── 11. Triggers ────────────────────────────────────────────────
		for (const [i, item] of (deltaSpec.triggers?.create ?? []).entries()) {
			const operationId = await resolveOperationId(prisma, projectId, createdIds, {
				operationName: item.operationName,
				operationId: item.operationId,
			});
			if (!operationId) {
				errors.push({
					path: `triggers.create[${i}].operationName`,
					code: "unresolved_operation_ref",
					message: `Operation "${item.operationName ?? item.operationId}" not found for trigger "${item.name}"`,
				});
				continue;
			}
			const row = await run(`triggers.create[${i}]`, () =>
				delegate(prisma, "Trigger").create({
					data: {
						projectId,
						name: item.name,
						kind: item.kind as never,
						source: item.source as never,
						operationId,
						inputMapping: (item.inputMapping ?? undefined) as never,
					},
				}),
			);
			if (row) { trackCreated("Trigger", item.name, row.id as string); appliedCount++; }
		}
		for (const [i, item] of (deltaSpec.triggers?.update ?? []).entries()) {
			const { id, ...patch } = item as WithId;
			const row = await run(`triggers.update[${i}]`, () =>
				delegate(prisma, "Trigger").update({ where: { id }, data: patch as never }),
			);
			if (row) appliedCount++;
		}

		// ── 12. Workflows (V1: not_implemented_yet) ──────────────────────
		if (deltaSpec.workflows?.create?.length || deltaSpec.workflows?.update?.length) {
			errors.push({ path: "workflows", code: "not_implemented_yet", message: "workflows bucket is V2 — skipped" });
		}

		// ── 13. AuthMethods (V1: not_implemented_yet) ────────────────────
		if (deltaSpec.authMethods?.create?.length || deltaSpec.authMethods?.update?.length) {
			errors.push({ path: "authMethods", code: "not_implemented_yet", message: "authMethods bucket is V2 — skipped" });
		}

		// ── 14. Assets (V1: not_implemented_yet) ─────────────────────────
		if (deltaSpec.assets?.create?.length || deltaSpec.assets?.update?.length) {
			errors.push({ path: "assets", code: "not_implemented_yet", message: "assets bucket is V2 — skipped" });
		}

		// ── 15. Screens ─────────────────────────────────────────────────
		for (const [i, item] of (deltaSpec.screens?.create ?? []).entries()) {
			const row = await run(`screens.create[${i}]`, () =>
				delegate(prisma, "Screen").create({
					data: {
						projectId,
						path: item.path,
						type: item.type,
						titleKey: item.titleKey,
						order: item.order ?? 0,
					},
				}),
			);
			if (row) { trackCreated("Screen", item.path, row.id as string); appliedCount++; }
		}
		for (const [i, item] of (deltaSpec.screens?.update ?? []).entries()) {
			const { id, ...patch } = item as WithId;
			const row = await run(`screens.update[${i}]`, () =>
				delegate(prisma, "Screen").update({ where: { id }, data: patch }),
			);
			if (row) appliedCount++;
		}

		// ── 16. Components (V1: not_implemented_yet) ─────────────────────
		if (deltaSpec.components?.create?.length || deltaSpec.components?.update?.length) {
			errors.push({ path: "components", code: "not_implemented_yet", message: "components bucket is V2 — skipped" });
		}

		// ── 17. Forms (V1: not_implemented_yet) ──────────────────────────
		if (deltaSpec.forms?.create?.length || deltaSpec.forms?.update?.length) {
			errors.push({ path: "forms", code: "not_implemented_yet", message: "forms bucket is V2 — skipped" });
		}

		// ── 18. Fields (V1: not_implemented_yet) ─────────────────────────
		if (deltaSpec.fields?.create?.length || deltaSpec.fields?.update?.length) {
			errors.push({ path: "fields", code: "not_implemented_yet", message: "fields bucket is V2 — skipped" });
		}

		// ── 19. Actions (V1: not_implemented_yet) ────────────────────────
		if (deltaSpec.actions?.create?.length || deltaSpec.actions?.update?.length) {
			errors.push({ path: "actions", code: "not_implemented_yet", message: "actions bucket is V2 — skipped" });
		}

		// ── 20. DataBindings (V1: not_implemented_yet) ───────────────────
		if (deltaSpec.dataBindings?.create?.length || deltaSpec.dataBindings?.update?.length) {
			errors.push({ path: "dataBindings", code: "not_implemented_yet", message: "dataBindings bucket is V2 — skipped" });
		}

		// ── 21. TestScenarios (V1: not_implemented_yet) ──────────────────
		if (deltaSpec.testScenarios?.create?.length || deltaSpec.testScenarios?.update?.length) {
			errors.push({ path: "testScenarios", code: "not_implemented_yet", message: "testScenarios bucket is V2 — skipped" });
		}

		// ── Deletes (last, all buckets) ──────────────────────────────────
		const deleteOrder = [
			["testScenarios", "TestScenario"],
			["dataBindings", "DataBinding"],
			["actions", "Action"],
			["fields", "Field"],
			["forms", "Form"],
			["components", "Component"],
			["screens", "Screen"],
			["triggers", "Trigger"],
			["resources", "Resource"],
			["operations", "Operation"],
			["policies", "Policy"],
			["integrations", "Integration"],
			["relations", "EntityRelation"],
			["attributes", "Attribute"],
			["entities", "Entity"],
			["workflows", "Workflow"],
			["authMethods", "AuthMethod"],
			["assets", "Asset"],
			["requirements", "Requirement"],
			["screenSpecs", "ScreenSpec"],
			["productSpecs", "ProductSpec"],
		] as const;

		for (const [bucket, model] of deleteOrder) {
			const deletes = (deltaSpec[bucket as keyof DeltaSpec] as { delete?: { id: string }[] } | undefined)?.delete ?? [];
			for (const [i, ref] of deletes.entries()) {
				const row = await run(`${bucket}.delete[${i}]`, () =>
					delegate(prisma, model).delete({ where: { id: ref.id } }),
				);
				if (row) appliedCount++;
			}
		}
	});

	// If there are hard errors (not just not_implemented_yet), mark as failed.
	const hardErrors = errors.filter((e) => e.code !== "not_implemented_yet");
	if (hardErrors.length > 0) {
		// NOTE: No FAILED status in schema — discard the CS to keep state clean.
		// Gap documented in docs/CHANGESET_AUDIT.md §4.
		try {
			await prisma.revision.deleteMany({ where: { changeSetId } });
			await prisma.changeSet.delete({ where: { id: changeSetId } });
		} catch {
			// Best-effort cleanup; ignore if already gone.
		}
		return { ok: false, appliedCount, createdIds, errors };
	}

	return {
		ok: true,
		appliedCount,
		createdIds,
		errors: errors.length > 0 ? errors : undefined,
	};
}
