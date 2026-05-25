// node:test — changeset flow integration tests (Phase 11)
// Run with: pnpm --filter backend test (or tsx directly)
// These tests mock the Prisma client so no DB is required.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

// ─── Minimal Prisma mock ──────────────────────────────────────────────────────

type Rev = {
	id: string;
	entityType: string;
	entityId: string;
	op: "CREATE" | "UPDATE" | "DELETE" | "RESTORE";
	data: Record<string, unknown>;
	diff: Record<string, [unknown, unknown]> | null;
	version: number;
	message: string | null;
	changeSetId: string | null;
};

type CS = {
	id: string;
	projectId: string;
	message: string;
	status: string;
	revertOfId: string | null;
	revertedById: string | null;
	revertedAt: Date | null;
	appliedAt: Date | null;
	revisions: Rev[];
};

// Simple in-memory store
let csStore: Map<string, CS>;
let revStore: Map<string, Rev>;
let entityStore: Map<string, { id: string; projectId: string; name: string; currentVersion: number }>;
let idCounter: number;

function mkId(): string {
	return `id_${++idCounter}`;
}

function resetStores() {
	csStore = new Map();
	revStore = new Map();
	entityStore = new Map();
	idCounter = 0;
}

function buildMockPrisma() {
	return {
		changeSet: {
			create: async (args: { data: Partial<CS> & { projectId: string; message: string } }) => {
				const cs: CS = {
					id: mkId(),
					projectId: args.data.projectId,
					message: args.data.message,
					status: args.data.status ?? "DRAFT",
					revertOfId: args.data.revertOfId ?? null,
					revertedById: null,
					revertedAt: null,
					appliedAt: args.data.appliedAt ?? null,
					revisions: [],
				};
				csStore.set(cs.id, cs);
				return cs;
			},
			findUnique: async (args: { where: { id: string }; include?: { revisions?: unknown } }) => {
				const cs = csStore.get(args.where.id);
				if (!cs) return null;
				if (args.include?.revisions) {
					cs.revisions = [...revStore.values()].filter((r) => r.changeSetId === cs.id);
				}
				return cs;
			},
			findFirst: async (args: { where: { id?: string; projectId?: string; status?: string } }) => {
				for (const cs of csStore.values()) {
					if (args.where.id && cs.id !== args.where.id) continue;
					if (args.where.projectId && cs.projectId !== args.where.projectId) continue;
					if (args.where.status && cs.status !== args.where.status) continue;
					cs.revisions = [...revStore.values()].filter((r) => r.changeSetId === cs.id);
					return cs;
				}
				return null;
			},
			update: async (args: { where: { id: string }; data: Partial<CS> }) => {
				const cs = csStore.get(args.where.id);
				if (!cs) throw new Error(`CS ${args.where.id} not found`);
				Object.assign(cs, args.data);
				return cs;
			},
			delete: async (args: { where: { id: string } }) => {
				csStore.delete(args.where.id);
				return {};
			},
		},
		revision: {
			create: async (args: { data: Partial<Rev> }) => {
				const rev: Rev = {
					id: mkId(),
					entityType: args.data.entityType ?? "",
					entityId: args.data.entityId ?? "",
					op: args.data.op ?? "CREATE",
					data: (args.data.data ?? {}) as Record<string, unknown>,
					diff: (args.data.diff ?? null) as Record<string, [unknown, unknown]> | null,
					version: args.data.version ?? 1,
					message: args.data.message ?? null,
					changeSetId: args.data.changeSetId ?? null,
				};
				revStore.set(rev.id, rev);
				return rev;
			},
			findFirst: async (args: {
				where: { entityType?: string; entityId?: string; version?: { lte?: number } };
				orderBy?: { version?: string };
			}) => {
				const candidates = [...revStore.values()].filter((r) => {
					if (args.where.entityType && r.entityType !== args.where.entityType) return false;
					if (args.where.entityId && r.entityId !== args.where.entityId) return false;
					if (args.where.version?.lte !== undefined && r.version > args.where.version.lte) return false;
					return true;
				});
				if (candidates.length === 0) return null;
				candidates.sort((a, b) =>
					args.orderBy?.version === "desc" ? b.version - a.version : a.version - b.version,
				);
				return candidates[0];
			},
			findMany: async (args: { where: { changeSetId?: string }; orderBy?: { version?: string } }) => {
				const results = [...revStore.values()].filter((r) => {
					if (args.where.changeSetId && r.changeSetId !== args.where.changeSetId) return false;
					return true;
				});
				if (args.orderBy?.version === "desc") results.sort((a, b) => b.version - a.version);
				else results.sort((a, b) => a.version - b.version);
				return results;
			},
			findUnique: async (args: { where: { id: string } }) => {
				return revStore.get(args.where.id) ?? null;
			},
			deleteMany: async (args: { where: { changeSetId?: string } }) => {
				for (const [id, r] of revStore) {
					if (args.where.changeSetId && r.changeSetId === args.where.changeSetId) {
						revStore.delete(id);
					}
				}
				return {};
			},
			count: async (args: { where: { changeSetId?: string } }) => {
				return [...revStore.values()].filter((r) => {
					if (args.where.changeSetId && r.changeSetId !== args.where.changeSetId) return false;
					return true;
				}).length;
			},
		},
		entity: {
			create: async (args: { data: { projectId: string; name: string; nameKey?: string } }) => {
				const entity = {
					id: mkId(),
					projectId: args.data.projectId,
					name: args.data.name,
					nameKey: args.data.nameKey ?? null,
					currentVersion: 1,
					createdAt: new Date(),
					updatedAt: new Date(),
				};
				entityStore.set(entity.id, entity);
				return entity;
			},
			findUnique: async (args: { where: { projectId_name?: { projectId: string; name: string }; id?: string }; select?: unknown }) => {
				if (args.where.id) return entityStore.get(args.where.id) ?? null;
				if (args.where.projectId_name) {
					for (const e of entityStore.values()) {
						if (e.projectId === args.where.projectId_name.projectId && e.name === args.where.projectId_name.name) {
							return e;
						}
					}
				}
				return null;
			},
			findMany: async (args: { where: { projectId?: string } }) => {
				return [...entityStore.values()].filter((e) => {
					if (args.where.projectId && e.projectId !== args.where.projectId) return false;
					return true;
				});
			},
			delete: async (args: { where: { id: string } }) => {
				const e = entityStore.get(args.where.id);
				if (!e) throw new Error(`Entity ${args.where.id} not found`);
				entityStore.delete(args.where.id);
				return e;
			},
		},
		attribute: {
			findMany: async () => [],
		},
		operation: {
			findMany: async () => [],
		},
	};
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("applyDeltaSpec", () => {
	it("dryRun returns { ok:true, appliedCount:0 }", async () => {
		const { applyDeltaSpec } = await import("./delta-spec-apply");
		resetStores();
		const mock = buildMockPrisma();

		const result = await applyDeltaSpec(mock as never, { entities: { create: [{ name: "Contact" }] } }, {
			projectId: "proj1",
			changeSetId: "cs1",
			dryRun: true,
		});

		assert.equal(result.ok, true);
		assert.equal(result.appliedCount, 0);
		assert.deepEqual(result.createdIds, {});
	});

	it("creates entity and tracks id in createdIds", async () => {
		const { applyDeltaSpec } = await import("./delta-spec-apply");
		resetStores();
		const mock = buildMockPrisma();

		// Pre-create a DRAFT changeset in the store
		const cs = await mock.changeSet.create({ data: { projectId: "proj1", message: "test", status: "DRAFT" } });

		const result = await applyDeltaSpec(mock as never, {
			entities: { create: [{ name: "Contact" }] },
		}, {
			projectId: "proj1",
			changeSetId: cs.id,
		});

		assert.equal(result.ok, true);
		assert.equal(result.appliedCount, 1);
		assert.ok(result.createdIds["Entity"]?.["Contact"], "Contact entity id should be tracked");
		// Entity exists in store
		const entityId = result.createdIds["Entity"]["Contact"];
		assert.ok(entityStore.get(entityId), "Entity should exist in mock store");
	});
});

describe("revertChangeSet", () => {
	it("reverts a CS with 1 CREATE: entity deleted, new CS created with revertOfId", async () => {
		const { revertChangeSet } = await import("./revert");
		resetStores();
		const mock = buildMockPrisma();

		// Set up: a CS with one CREATE revision for an entity
		const origCs = await mock.changeSet.create({
			data: { projectId: "proj1", message: "original", status: "APPLIED", appliedAt: new Date() },
		});

		// Create the entity in the mock store
		const entity = await mock.entity.create({ data: { projectId: "proj1", name: "ToDelete" } });

		// Create a revision for it
		await mock.revision.create({
			data: {
				entityType: "Entity",
				entityId: entity.id,
				op: "CREATE",
				data: { id: entity.id, projectId: "proj1", name: "ToDelete" },
				diff: null,
				version: 1,
				changeSetId: origCs.id,
				message: null,
			},
		});

		const result = await revertChangeSet(mock as never, origCs.id);

		assert.ok(result.revertChangeSetId, "should return a new CS id");
		assert.notEqual(result.revertChangeSetId, origCs.id);

		// Original CS should be REVERTED
		const updated = csStore.get(origCs.id);
		assert.equal(updated?.status, "REVERTED");
		assert.equal(updated?.revertedById, result.revertChangeSetId);

		// New CS should have revertOfId = original
		const newCs = csStore.get(result.revertChangeSetId);
		assert.equal(newCs?.revertOfId, origCs.id);

		// Entity should be deleted
		assert.equal(entityStore.get(entity.id), undefined, "Entity should have been deleted by revert");
	});
});

describe("getSpecAt", () => {
	it("getSpecAt(latest) returns current entities", async () => {
		const { getSpecAt } = await import("./spec-snapshot");
		resetStores();
		const mock = buildMockPrisma();

		await mock.entity.create({ data: { projectId: "proj1", name: "Alpha" } });
		await mock.entity.create({ data: { projectId: "proj1", name: "Beta" } });

		const spec = await getSpecAt(mock as never, "proj1", "latest");

		assert.equal(spec.entities.length, 2);
		assert.ok(spec.entities.some((e) => e.name === "Alpha"));
		assert.ok(spec.entities.some((e) => e.name === "Beta"));
	});
});

describe("diffChangeSets", () => {
	it("returns onlyInA, onlyInB for two distinct ChangeSets", async () => {
		const { diffChangeSets } = await import("./changeset-diff");
		resetStores();
		const mock = buildMockPrisma();

		const csA = await mock.changeSet.create({ data: { projectId: "proj1", message: "A", status: "APPLIED" } });
		const csB = await mock.changeSet.create({ data: { projectId: "proj1", message: "B", status: "APPLIED" } });

		await mock.revision.create({
			data: { entityType: "Entity", entityId: "ent_1", op: "CREATE", version: 1, changeSetId: csA.id, diff: null, data: {}, message: null },
		});
		await mock.revision.create({
			data: { entityType: "Entity", entityId: "ent_2", op: "CREATE", version: 1, changeSetId: csB.id, diff: null, data: {}, message: null },
		});

		const diff = await diffChangeSets(mock as never, csA.id, csB.id);

		assert.equal(diff.onlyInA.length, 1);
		assert.equal(diff.onlyInA[0]?.entityId, "ent_1");
		assert.equal(diff.onlyInB.length, 1);
		assert.equal(diff.onlyInB[0]?.entityId, "ent_2");
		assert.equal(diff.commonChanged.length, 0);
	});
});

describe("Gate: implicit CS middleware", () => {
	it("changeset-middleware creates implicit CS when X-ChangeSet-Id absent (documented behavior)", async () => {
		// Verify the source code documents the implicit CS behavior without importing
		// the module (importing it would load db.ts which requires DATABASE_URL).
		// The "no explicit CS gate" is the correct V1 behavior — see CHANGESET_AUDIT.md §3.
		const { readFileSync } = await import("node:fs");
		const src = readFileSync(
			new URL("./changeset-middleware.ts", import.meta.url).pathname,
			"utf8",
		);
		// Confirm implicit CS creation is present (not a hard gate)
		assert.ok(src.includes("Implicit one-revision ChangeSet"), "middleware must document implicit CS creation");
		assert.ok(src.includes("changeSet.create"), "middleware must create an implicit CS when no X-ChangeSet-Id header");
	});
});
