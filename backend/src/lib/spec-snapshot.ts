// Reconstruct the Control Plane state as it was at a given Revision version.
//
// V1 scope: Entities + Attributes + Operations only.
// For all other buckets the returned spec has an empty array — V2.
//
// Algorithm per model:
//   1. Fetch current row (if exists).
//   2. If it was last modified at version <= atVersion, return the current row.
//   3. Otherwise, walk the Revision history backwards to find the snapshot
//      at or before atVersion.
//   4. If the entity was created AFTER atVersion, exclude it entirely.

import type { ExtendedPrismaClient } from "../versioning";

export type EntitySnapshot = {
	id: string;
	name: string;
	nameKey: string | null;
	currentVersion: number;
};

export type AttributeSnapshot = {
	id: string;
	entityId: string;
	name: string;
	type: string;
	required: boolean;
	unique: boolean;
	config: unknown;
	currentVersion: number;
};

export type OperationSnapshot = {
	id: string;
	name: string;
	kind: string;
	inputSchema: unknown;
	outputSchema: unknown;
	reads: unknown;
	writes: unknown;
	steps: unknown;
	currentVersion: number;
};

export type ProjectSpec = {
	entities: EntitySnapshot[];
	attributes: AttributeSnapshot[];
	operations: OperationSnapshot[];
	// V2 buckets — always empty in V1
	relations: unknown[];
	resources: unknown[];
	policies: unknown[];
	screens: unknown[];
};

// ─── Internal helper ─────────────────────────────────────────────────────────

async function reconstructAtVersion(
	prisma: ExtendedPrismaClient,
	entityType: string,
	entityId: string,
	atVersion: number,
): Promise<Record<string, unknown> | null> {
	// Find the highest Revision <= atVersion
	const rev = await (prisma as unknown as {
		revision: {
			findFirst: (a: unknown) => Promise<{
				version: number;
				op: string;
				data: Record<string, unknown>;
			} | null>;
		};
	}).revision.findFirst({
		where: { entityType, entityId, version: { lte: atVersion } },
		orderBy: { version: "desc" },
	});
	if (!rev) return null;
	if (rev.op === "DELETE") return null; // was deleted at or before atVersion
	return rev.data;
}

// ─── Main function ───────────────────────────────────────────────────────────

export async function getSpecAt(
	prisma: ExtendedPrismaClient,
	projectId: string,
	atRevisionVersion: number | "latest",
): Promise<ProjectSpec> {
	const spec: ProjectSpec = {
		entities: [],
		attributes: [],
		operations: [],
		relations: [],
		resources: [],
		policies: [],
		screens: [],
	};

	if (atRevisionVersion === "latest") {
		// Short-circuit: just return the current state.
		const [entities, attributes, operations] = await Promise.all([
			(prisma as unknown as {
				entity: { findMany: (a: unknown) => Promise<EntitySnapshot[]> };
			}).entity.findMany({ where: { projectId }, orderBy: { name: "asc" } }),
			(prisma as unknown as {
				attribute: {
					findMany: (a: unknown) => Promise<AttributeSnapshot[]>;
				};
			}).attribute.findMany({
				where: { entity: { projectId } },
				orderBy: { name: "asc" },
			}),
			(prisma as unknown as {
				operation: { findMany: (a: unknown) => Promise<OperationSnapshot[]> };
			}).operation.findMany({ where: { projectId }, orderBy: { name: "asc" } }),
		]);
		spec.entities = entities;
		spec.attributes = attributes;
		spec.operations = operations;
		return spec;
	}

	const version = atRevisionVersion;

	// ── Entities ────────────────────────────────────────────────────────────
	const currentEntities = await (prisma as unknown as {
		entity: { findMany: (a: unknown) => Promise<EntitySnapshot[]> };
	}).entity.findMany({ where: { projectId } });

	for (const entity of currentEntities) {
		if (entity.currentVersion <= version) {
			// Not modified after atVersion — current row is correct.
			spec.entities.push(entity);
		} else {
			// Row was modified after atVersion — need to reconstruct.
			const snap = await reconstructAtVersion(prisma, "Entity", entity.id, version);
			if (snap) spec.entities.push(snap as unknown as EntitySnapshot);
		}
	}

	// Also check for entities that were DELETED after atVersion (they no longer
	// appear in currentEntities). Find CREATE Revisions for this project's
	// entities at version <= atVersion where no DELETE revision <= atVersion.
	// This is a best-effort approach: query Revision for Entity creates <= atVersion.
	const entityCreateRevs = await (prisma as unknown as {
		revision: {
			findMany: (a: unknown) => Promise<{
				entityId: string;
				op: string;
				data: Record<string, unknown>;
			}[]>;
		};
	}).revision.findMany({
		where: {
			entityType: "Entity",
			op: "CREATE",
			version: { lte: version },
			// Only for this project: filter by data.projectId if possible
			// (Revision.data is Json, no indexed query — use a post-filter)
		},
		orderBy: { version: "asc" },
	});
	const currentEntityIds = new Set(currentEntities.map((e) => e.id));
	for (const rev of entityCreateRevs) {
		if (currentEntityIds.has(rev.entityId)) continue; // already in spec
		const data = rev.data as Record<string, unknown>;
		if (data.projectId !== projectId) continue;
		// This entity was deleted. Check if it existed at atVersion.
		const snap = await reconstructAtVersion(prisma, "Entity", rev.entityId, version);
		if (snap) spec.entities.push(snap as unknown as EntitySnapshot);
	}

	// ── Attributes ───────────────────────────────────────────────────────────
	const entityIds = new Set(spec.entities.map((e) => e.id));
	const currentAttributes = await (prisma as unknown as {
		attribute: { findMany: (a: unknown) => Promise<AttributeSnapshot[]> };
	}).attribute.findMany({
		where: { entityId: { in: [...entityIds] } },
	});

	for (const attr of currentAttributes) {
		if (attr.currentVersion <= version) {
			spec.attributes.push(attr);
		} else {
			const snap = await reconstructAtVersion(prisma, "Attribute", attr.id, version);
			if (snap) spec.attributes.push(snap as unknown as AttributeSnapshot);
		}
	}

	// ── Operations ───────────────────────────────────────────────────────────
	const currentOps = await (prisma as unknown as {
		operation: { findMany: (a: unknown) => Promise<OperationSnapshot[]> };
	}).operation.findMany({ where: { projectId } });

	for (const op of currentOps) {
		if (op.currentVersion <= version) {
			spec.operations.push(op);
		} else {
			const snap = await reconstructAtVersion(prisma, "Operation", op.id, version);
			if (snap) spec.operations.push(snap as unknown as OperationSnapshot);
		}
	}

	return spec;
}
