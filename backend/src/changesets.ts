import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "./db";
import { runInChangeSet } from "./lib/changeset-context";
import { applyDeltaSpec } from "./lib/delta-spec-apply";
import { diffChangeSets } from "./lib/changeset-diff";
import { getSpecAt } from "./lib/spec-snapshot";
import { revertField, revertOne, revertChangeSet, type RevertEntry } from "./lib/revert";
import { validationHook } from "./lib/validation-hook";
import { deltaSpecSchema } from "./lib/dsl/delta-spec";
import { emitAuditEvent } from "./lib/governance/audit";

export const changeSetsRoutes = new Hono()
	// List ChangeSets for a project (latest first).
	.get("/", async (c) => {
		const projectId = c.req.param("id") as string;
		const limit = Number(c.req.query("limit") ?? 50);
		const before = c.req.query("before");
		const items = await prisma.changeSet.findMany({
			where: {
				projectId,
				...(before ? { createdAt: { lt: new Date(before) } } : {}),
			},
			orderBy: { createdAt: "desc" },
			take: Math.min(limit, 200),
			include: {
				actor: { select: { id: true, name: true, email: true } },
				_count: { select: { revisions: true } },
			},
		});
		return c.json({ items });
	})
	// GET /spec-at?version=<n>|latest — must come before /:csid to avoid shadowing.
	.get("/spec-at", async (c) => {
		const projectId = c.req.param("id") as string;
		const versionParam = c.req.query("version") ?? "latest";
		const atVersion: number | "latest" =
			versionParam === "latest" ? "latest" : Number(versionParam);
		if (versionParam !== "latest" && Number.isNaN(atVersion as number)) {
			return c.json({ error: "invalid_version" }, 400);
		}
		const spec = await getSpecAt(prisma, projectId, atVersion);
		return c.json({ spec });
	})
	// GET /diff?a=<csId>&b=<csId> OR ?from=<csId>&to=<csId> — must come before /:csid.
	.get("/diff", async (c) => {
		const a = c.req.query("a") ?? c.req.query("from");
		const b = c.req.query("b") ?? c.req.query("to");
		if (!a || !b) return c.json({ error: "missing_a_or_b_or_from_to" }, 400);
		const result = await diffChangeSets(prisma, a, b);
		return c.json(result);
	})
	// GET /:csid/spec-at — snapshot of the project as it was just after this ChangeSet.
	// Finds the highest Revision version linked to this CS and calls getSpecAt.
	.get("/:csid/spec-at", async (c) => {
		const params = c.req.param() as Record<string, string>;
		const projectId = params.id as string;
		const csid = params.csid as string;
		const cs = await prisma.changeSet.findFirst({ where: { id: csid, projectId } });
		if (!cs) return c.json({ error: "not_found" }, 404);
		// Find the maximum Revision version attached to this ChangeSet.
		const topRev = await prisma.revision.findFirst({
			where: { changeSetId: csid },
			orderBy: { version: "desc" },
		});
		const atVersion: number | "latest" = topRev ? topRev.version : "latest";
		const spec = await getSpecAt(prisma, projectId, atVersion);
		return c.json({ changeSetId: csid, atVersion, spec });
	})
	// Detail + Revisions of one ChangeSet.
	.get("/:csid", async (c) => {
		const params = c.req.param() as Record<string, string>;
		const projectId = params.id as string;
		const csid = params.csid as string;
		const cs = await prisma.changeSet.findFirst({
			where: { id: csid, projectId },
			include: {
				actor: { select: { id: true, name: true, email: true } },
				revisions: { orderBy: { createdAt: "asc" } },
			},
		});
		if (!cs) return c.json({ error: "not_found" }, 404);
		return c.json({ changeSet: cs });
	})
	// Open a DRAFT.
	.post(
		"/",
		zValidator(
			"json",
			z.object({ message: z.string().min(1).max(512) }),
			validationHook,
		),
		async (c) => {
			const projectId = c.req.param("id") as string;
			const { message } = c.req.valid("json");
			const cs = await prisma.changeSet.create({
				data: { projectId, message, status: "DRAFT" },
			});
			return c.json({ changeSet: cs }, 201);
		},
	)
	// Commit a DRAFT.
	.post("/:csid/commit", async (c) => {
		const params = c.req.param() as Record<string, string>;
		const projectId = params.id as string;
		const csid = params.csid as string;
		const cs = await prisma.changeSet.findFirst({
			where: { id: csid, projectId },
		});
		if (!cs) return c.json({ error: "not_found" }, 404);
		if (cs.status !== "DRAFT")
			return c.json({ error: "not_draft", status: cs.status }, 409);
		const updated = await prisma.changeSet.update({
			where: { id: csid },
			data: { status: "APPLIED", appliedAt: new Date() },
		});
		void emitAuditEvent({ projectId, action: "commit_changeset", target: { changeSetId: csid }, metadata: { message: cs.message } });
		return c.json({ changeSet: updated });
	})
	// Discard a DRAFT (deletes the row + its Revisions).
	.delete("/:csid", async (c) => {
		const params = c.req.param() as Record<string, string>;
		const projectId = params.id as string;
		const csid = params.csid as string;
		const cs = await prisma.changeSet.findFirst({
			where: { id: csid, projectId },
		});
		if (!cs) return c.json({ error: "not_found" }, 404);
		if (cs.status !== "DRAFT")
			return c.json({ error: "not_draft_use_revert" }, 409);
		await prisma.revision.deleteMany({ where: { changeSetId: csid } });
		await prisma.changeSet.delete({ where: { id: csid } });
		return c.json({ ok: true });
	})
	// Revert an APPLIED ChangeSet — creates a NEW APPLIED ChangeSet with
	// inverse Revisions, marks the original as REVERTED.
	.post("/:csid/revert", async (c) => {
		const params = c.req.param() as Record<string, string>;
		const projectId = params.id as string;
		const csid = params.csid as string;
		const original = await prisma.changeSet.findFirst({
			where: { id: csid, projectId },
			include: { revisions: { orderBy: { createdAt: "asc" } } },
		});
		if (!original) return c.json({ error: "not_found" }, 404);
		if (original.status !== "APPLIED")
			return c.json({ error: "not_applied", status: original.status }, 409);

		const newCs = await prisma.changeSet.create({
			data: {
				projectId,
				message: `revert of "${original.message}"`,
				status: "APPLIED",
				appliedAt: new Date(),
				revertOfId: original.id,
			},
		});

		const entries: RevertEntry[] = [];
		await runInChangeSet(
			{ changeSetId: newCs.id, projectId, origin: "explicit" },
			async () => {
				for (const rev of [...original.revisions].reverse()) {
					entries.push(await revertOne(prisma, rev));
				}
			},
		);

		await prisma.changeSet.update({
			where: { id: original.id },
			data: { status: "REVERTED", revertedAt: new Date(), revertedById: newCs.id },
		});

		void emitAuditEvent({ projectId, action: "revert_changeset", target: { originalChangeSetId: csid, newChangeSetId: newCs.id }, metadata: { message: original.message } });

		return c.json({ changeSet: newCs, entries });
	});

// Apply a DeltaSpec within a ChangeSet.
// POST /api/projects/:id/changesets/apply
// Body: { changeSetId, deltaSpec, dryRun? }
changeSetsRoutes.post(
	"/apply",
	zValidator(
		"json",
		z.object({
			changeSetId: z.string().min(1),
			deltaSpec: z.record(z.unknown()),
			dryRun: z.boolean().optional(),
		}),
		validationHook,
	),
	async (c) => {
		const projectId = c.req.param("id") as string;
		const { changeSetId, deltaSpec: rawDelta, dryRun } = c.req.valid("json");

		const parsed = deltaSpecSchema.passthrough().safeParse(rawDelta);
		if (!parsed.success) {
			return c.json({ ok: false, errors: parsed.error.issues }, 400);
		}

		const result = await applyDeltaSpec(prisma, parsed.data, {
			projectId,
			changeSetId,
			dryRun,
		});

		return c.json(result, result.ok ? 200 : 422);
	},
);

// ─── Top-level ChangeSet routes (no projectId in URL) ──────────────
// Mounted at /api/changesets in app.ts.
// Retrieves the projectId from the ChangeSet row itself.
export const changesetsTopRoutes = new Hono()
	// GET /api/changesets/:id — detail with Revisions
	.get("/:id", async (c) => {
		const id = c.req.param("id");
		const cs = await prisma.changeSet.findUnique({
			where: { id },
			include: {
				actor: { select: { id: true, name: true, email: true } },
				revisions: { orderBy: { createdAt: "asc" } },
			},
		});
		if (!cs) return c.json({ error: "not_found" }, 404);
		return c.json({ changeSet: cs });
	})
	// POST /api/changesets/:id/commit
	.post("/:id/commit", async (c) => {
		const id = c.req.param("id");
		const cs = await prisma.changeSet.findUnique({ where: { id } });
		if (!cs) return c.json({ error: "not_found" }, 404);
		if (cs.status !== "DRAFT")
			return c.json({ error: "not_draft", status: cs.status }, 409);
		const updated = await prisma.changeSet.update({
			where: { id },
			data: { status: "APPLIED", appliedAt: new Date() },
		});
		return c.json({ changeSet: updated });
	})
	// POST /api/changesets/:id/discard
	.post("/:id/discard", async (c) => {
		const id = c.req.param("id");
		const cs = await prisma.changeSet.findUnique({ where: { id } });
		if (!cs) return c.json({ error: "not_found" }, 404);
		if (cs.status !== "DRAFT")
			return c.json({ error: "not_draft_use_revert" }, 409);
		await prisma.revision.deleteMany({ where: { changeSetId: id } });
		await prisma.changeSet.delete({ where: { id } });
		return c.json({ ok: true });
	})
	// POST /api/changesets/:id/revert
	.post("/:id/revert", async (c) => {
		const id = c.req.param("id");
		const original = await prisma.changeSet.findUnique({
			where: { id },
			include: { revisions: { orderBy: { createdAt: "asc" } } },
		});
		if (!original) return c.json({ error: "not_found" }, 404);
		if (original.status !== "APPLIED")
			return c.json({ error: "not_applied", status: original.status }, 409);

		const newCs = await prisma.changeSet.create({
			data: {
				projectId: original.projectId,
				message: `revert of "${original.message}"`,
				status: "APPLIED",
				appliedAt: new Date(),
				revertOfId: original.id,
			},
		});

		const entries: RevertEntry[] = [];
		await runInChangeSet(
			{ changeSetId: newCs.id, projectId: original.projectId, origin: "explicit" },
			async () => {
				for (const rev of [...original.revisions].reverse()) {
					entries.push(await revertOne(prisma, rev));
				}
			},
		);

		await prisma.changeSet.update({
			where: { id: original.id },
			data: { status: "REVERTED", revertedAt: new Date(), revertedById: newCs.id },
		});

		return c.json({ changeSet: newCs, entries });
	});

// Mounted under /api/revisions — ultra-fine revert (no projectId in path).
export const revisionRevertRoutes = new Hono()
	.post("/:rid/revert", async (c) => {
		const rid = c.req.param("rid");
		const rev = await prisma.revision.findUnique({ where: { id: rid } });
		if (!rev) return c.json({ error: "not_found" }, 404);
		// Find the project via the related row, fallback to current changeSet.
		const cs = rev.changeSetId
			? await prisma.changeSet.findUnique({ where: { id: rev.changeSetId } })
			: null;
		if (!cs)
			return c.json({ error: "no_owning_changeset_cannot_attribute_project" }, 400);

		const newCs = await prisma.changeSet.create({
			data: {
				projectId: cs.projectId,
				message: `revert revision ${rev.id}`,
				status: "APPLIED",
				appliedAt: new Date(),
			},
		});

		let entry: RevertEntry | null = null;
		await runInChangeSet(
			{ changeSetId: newCs.id, projectId: cs.projectId, origin: "explicit" },
			async () => {
				entry = await revertOne(prisma, rev);
			},
		);

		return c.json({ changeSet: newCs, entry });
	})
	.post(
		"/:rid/revert-field",
		zValidator(
			"json",
			z.object({ field: z.string().min(1) }),
			validationHook,
		),
		async (c) => {
			const rid = c.req.param("rid");
			const { field } = c.req.valid("json");
			const rev = await prisma.revision.findUnique({ where: { id: rid } });
			if (!rev) return c.json({ error: "not_found" }, 404);
			const cs = rev.changeSetId
				? await prisma.changeSet.findUnique({ where: { id: rev.changeSetId } })
				: null;
			if (!cs)
				return c.json({ error: "no_owning_changeset" }, 400);

			const newCs = await prisma.changeSet.create({
				data: {
					projectId: cs.projectId,
					message: `revert field ${field} of revision ${rev.id}`,
					status: "APPLIED",
					appliedAt: new Date(),
				},
			});

			let entry: RevertEntry | null = null;
			await runInChangeSet(
				{
					changeSetId: newCs.id,
					projectId: cs.projectId,
					origin: "explicit",
				},
				async () => {
					entry = await revertField(prisma, rev, field);
				},
			);

			return c.json({ changeSet: newCs, entry });
		},
	);
