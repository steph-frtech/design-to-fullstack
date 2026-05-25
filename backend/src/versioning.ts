// Prisma client extension that captures every create/update/delete on
// "versioned" models into the Revision table. Each mutation bumps the
// row's `currentVersion` and writes a snapshot.
//
// Limitations (acceptable for v1):
//   - `createMany`/`updateMany`/`deleteMany` are not intercepted (no ids returned).
//   - `upsert` is not intercepted yet.
//   - If you call update with `select`/`include` we re-fetch the full row
//     to get a complete snapshot.

import type { PrismaClient } from "../generated/prisma/client";
import { getChangeSet } from "./lib/changeset-context";

// Subset of VERSIONED_MODELS that ALSO have a `currentVersion` column on
// their row. For these, the update interceptor bumps the column. Others
// (Phase 3+: OpenQuestion, Assumption) are versioned via Revision rows
// only.
const MODELS_WITH_CURRENT_VERSION = new Set<string>([
	"Project",
	"Theme",
	"Entity",
	"Attribute",
	"EntityRecord",
	"Screen",
	"Component",
	"Form",
	"Field",
	"FieldOption",
	"Translation",
	"EntityRelation",
	"Resource",
	"Operation",
	"Policy",
	"Integration",
	"Trigger",
	"Behavior",
	"ProductSpec",
	"ScreenSpec",
	"SpecArtifact",
	"Requirement",
	"PlatformSpecProposal",
]);

const VERSIONED_MODELS = new Set<string>([
	"Project",
	"Theme",
	"Entity",
	"Attribute",
	"EntityRecord",
	"Screen",
	"Component",
	"Form",
	"Field",
	"FieldOption",
	"Translation",
	// Control Plane V1 — new concepts (ChangeSet itself is NOT versioned).
	"EntityRelation",
	"Resource",
	"Operation",
	"Policy",
	"Integration",
	"Trigger",
	"Behavior",
	// Phase 1 — Product Understanding
	"ProductSpec",
	// Phase 2 — Screen Understanding
	"ScreenSpec",
	// Phase 3 — Clarification
	"OpenQuestion",
	"Assumption",
	// Phase 4 — Spec Kit
	"SpecArtifact",
	// Phase 5 — Platform Mapping
	"Requirement",
	"RequirementMapping",
	// Phase 6 — PlatformSpec Proposal
	"PlatformSpecProposal",
	// Phase 10 — Full-stack app coverage (versioned, not AuditLog)
	"Workflow",
	"Asset",
	"AuthMethod",
	"Secret",
	"Environment",
	"AppRole",
	"EventDefinition",
	"Action",
	"DataBinding",
	"GeneratedArtifact",
	"DeploymentTarget",
	"TestScenario",
	// Step 25 — Runtime Target (versioned: it is a definition, not a generated artefact)
	// BackendContract / FrontendContract / SharedContract are NOT versioned here:
	// they are fully re-generated from Control Plane data on every codegen pass
	// (like GeneratedArtifact rows). Versioning them would create noisy Revision
	// rows on every regeneration with no actionable diff.
	"RuntimeTarget",
]);

type AnyRow = Record<string, unknown> & { id?: string; currentVersion?: number };

function diffRows(before: AnyRow | null, after: AnyRow): Record<string, [unknown, unknown]> {
	const diff: Record<string, [unknown, unknown]> = {};
	const keys = new Set([
		...Object.keys(before ?? {}),
		...Object.keys(after ?? {}),
	]);
	for (const k of keys) {
		const a = (before as AnyRow | null)?.[k];
		const b = after[k];
		if (JSON.stringify(a) !== JSON.stringify(b)) diff[k] = [a, b];
	}
	return diff;
}

function delegateOf(client: PrismaClient, model: string) {
	const key = model.charAt(0).toLowerCase() + model.slice(1);
	const delegate = (
		client as unknown as Record<
			string,
			{ findUnique: (a: unknown) => Promise<AnyRow | null> } | undefined
		>
	)[key];
	if (!delegate) throw new Error(`No delegate for model ${model}`);
	return delegate;
}

// For models without an in-row currentVersion column, derive the next
// revision version from the Revision table.
async function nextRevisionVersion(
	client: PrismaClient,
	model: string,
	entityId: string,
): Promise<number> {
	const last = await client.revision.findFirst({
		where: { entityType: model, entityId },
		orderBy: { version: "desc" },
		select: { version: true },
	});
	return (last?.version ?? 0) + 1;
}

export function withVersioning(client: PrismaClient) {
	return client.$extends({
		name: "dtfs-versioning",
		query: {
			$allModels: {
				async create({ model, args, query }) {
					const result = (await query(args)) as AnyRow;
					if (VERSIONED_MODELS.has(model) && result?.id) {
						const cs = getChangeSet();
						const version = MODELS_WITH_CURRENT_VERSION.has(model)
							? (result.currentVersion ?? 1)
							: await nextRevisionVersion(client, model, result.id);
						await client.revision.create({
							data: {
								entityType: model,
								entityId: result.id,
								version,
								op: "CREATE",
								data: result as object,
								changeSetId: cs?.changeSetId ?? null,
								actorId: cs?.actorId ?? null,
							},
						});
					}
					return result;
				},

				async update({ model, args, query }) {
					if (!VERSIONED_MODELS.has(model)) return query(args);

					const delegate = delegateOf(client, model);
					const before = await delegate.findUnique({
						where: (args as { where: unknown }).where,
					});

					const data = (args as { data: Record<string, unknown> }).data;
					if (
						data &&
						data.currentVersion === undefined &&
						MODELS_WITH_CURRENT_VERSION.has(model)
					) {
						data.currentVersion = { increment: 1 };
					}

					await query(args);

					const after = (await delegate.findUnique({
						where: (args as { where: unknown }).where,
					})) as AnyRow | null;
					if (!after?.id) return after;

					const cs = getChangeSet();
					const version = MODELS_WITH_CURRENT_VERSION.has(model)
						? (after.currentVersion ?? 1)
						: await nextRevisionVersion(client, model, after.id);
					await client.revision.create({
						data: {
							entityType: model,
							entityId: after.id,
							version,
							op: "UPDATE",
							data: after as object,
							diff: diffRows(before, after) as object,
							changeSetId: cs?.changeSetId ?? null,
							actorId: cs?.actorId ?? null,
						},
					});
					return after;
				},

				async delete({ model, args, query }) {
					if (!VERSIONED_MODELS.has(model)) return query(args);

					const delegate = delegateOf(client, model);
					const before = (await delegate.findUnique({
						where: (args as { where: unknown }).where,
					})) as AnyRow | null;

					const result = await query(args);

					if (before?.id) {
						const cs = getChangeSet();
						const version = MODELS_WITH_CURRENT_VERSION.has(model)
							? (before.currentVersion ?? 0) + 1
							: await nextRevisionVersion(client, model, before.id);
						await client.revision.create({
							data: {
								entityType: model,
								entityId: before.id,
								version,
								op: "DELETE",
								data: before as object,
								changeSetId: cs?.changeSetId ?? null,
								actorId: cs?.actorId ?? null,
							},
						});
					}
					return result;
				},
			},
		},
	});
}

export type ExtendedPrismaClient = ReturnType<typeof withVersioning>;
