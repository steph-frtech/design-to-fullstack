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

export function withVersioning(client: PrismaClient) {
	return client.$extends({
		name: "dtfs-versioning",
		query: {
			$allModels: {
				async create({ model, args, query }) {
					const result = (await query(args)) as AnyRow;
					if (VERSIONED_MODELS.has(model) && result?.id) {
						await client.revision.create({
							data: {
								entityType: model,
								entityId: result.id,
								version: result.currentVersion ?? 1,
								op: "CREATE",
								data: result as object,
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
					if (data && data.currentVersion === undefined) {
						data.currentVersion = { increment: 1 };
					}

					await query(args);

					const after = (await delegate.findUnique({
						where: (args as { where: unknown }).where,
					})) as AnyRow | null;
					if (!after?.id) return after;

					await client.revision.create({
						data: {
							entityType: model,
							entityId: after.id,
							version: after.currentVersion ?? 1,
							op: "UPDATE",
							data: after as object,
							diff: diffRows(before, after) as object,
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
						await client.revision.create({
							data: {
								entityType: model,
								entityId: before.id,
								version: (before.currentVersion ?? 0) + 1,
								op: "DELETE",
								data: before as object,
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
