import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../db";
import { validateSddArtifacts } from "../lib/sdd-validation";
import { pathForKind, sha256, syncFromDisk, syncToDisk } from "../lib/spec-kit-sync";
import { validationHook } from "../lib/validation-hook";

const createBody = z.object({
	kind: z.string().min(1).max(64),
	featureKey: z.string().min(1).max(128).optional(),
	path: z.string().optional(),
	content: z.string(),
	source: z.enum(["generated", "speckit", "manual"]).default("manual"),
});

const updateBody = z.object({
	kind: z.string().min(1).max(64).optional(),
	featureKey: z.string().max(128).optional(),
	path: z.string().optional(),
	content: z.string().optional(),
	source: z.enum(["generated", "speckit", "manual"]).optional(),
});

const generateBody = z.object({
	featureKey: z.string().min(1).max(128).optional(),
	source: z.enum(["generated", "speckit", "manual"]).default("generated"),
	artifacts: z
		.array(
			z.object({
				kind: z.string().min(1).max(64),
				content: z.string(),
				path: z.string().optional(),
			}),
		)
		.min(1),
});

const syncBody = z.object({
	direction: z.enum(["to-disk", "from-disk"]),
	featureKey: z.string().optional(),
});

export const sddArtifactsRoutes = new Hono()
	.get("/", async (c) => {
		const projectId = c.req.param("id" as never) as string;
		const kind = c.req.query("kind");
		const featureKey = c.req.query("featureKey");
		const items = await prisma.specArtifact.findMany({
			where: {
				projectId,
				...(kind ? { kind } : {}),
				...(featureKey !== undefined ? { featureKey } : {}),
			},
			orderBy: { updatedAt: "desc" },
		});
		return c.json({ items });
	})
	.get("/:said", async (c) => {
		const { id: projectId, said } = c.req.param() as Record<string, string>;
		const item = await prisma.specArtifact.findFirst({
			where: { id: said, projectId },
		});
		if (!item) return c.json({ error: "not_found" }, 404);
		return c.json({ item });
	})
	.post("/", zValidator("json", createBody, validationHook), async (c) => {
		const projectId = c.req.param("id" as never) as string;
		const data = c.req.valid("json");
		const resolvedPath =
			data.path ?? pathForKind(data.kind, data.featureKey ?? null);
		const item = await prisma.specArtifact.create({
			data: {
				projectId,
				kind: data.kind,
				featureKey: data.featureKey,
				path: resolvedPath,
				content: data.content,
				contentHash: sha256(data.content),
				source: data.source,
			},
		});
		return c.json({ item }, 201);
	})
	.put("/:said", zValidator("json", updateBody, validationHook), async (c) => {
		const { id: projectId, said } = c.req.param() as Record<string, string>;
		const data = c.req.valid("json");
		const updateData: Record<string, unknown> = {};
		if (data.kind !== undefined) updateData.kind = data.kind;
		if (data.featureKey !== undefined) updateData.featureKey = data.featureKey;
		if (data.path !== undefined) updateData.path = data.path;
		if (data.content !== undefined) {
			updateData.content = data.content;
			updateData.contentHash = sha256(data.content);
		}
		if (data.source !== undefined) updateData.source = data.source;
		const item = await prisma.specArtifact.update({
			where: { id: said, projectId },
			data: updateData as never,
		});
		return c.json({ item });
	})
	.delete("/:said", async (c) => {
		const { id: projectId, said } = c.req.param() as Record<string, string>;
		await prisma.specArtifact.delete({ where: { id: said, projectId } });
		return c.json({ ok: true });
	})
	// Bulk upsert from agent output
	.post(
		"/generate",
		zValidator("json", generateBody, validationHook),
		async (c) => {
			const projectId = c.req.param("id" as never) as string;
			const data = c.req.valid("json");
			const upserted: { id: string; kind: string; featureKey: string | null }[] = [];
			for (const a of data.artifacts) {
				const featureKey = a.kind === "constitution" ? null : data.featureKey ?? null;
				const resolvedPath = a.path ?? pathForKind(a.kind, featureKey);
				const existing = await prisma.specArtifact.findFirst({
					where: { projectId, kind: a.kind, featureKey },
					orderBy: { updatedAt: "desc" },
				});
				const hash = sha256(a.content);
				const row = existing
					? await prisma.specArtifact.update({
							where: { id: existing.id },
							data: {
								content: a.content,
								contentHash: hash,
								source: data.source,
								path: resolvedPath,
							},
						})
					: await prisma.specArtifact.create({
							data: {
								projectId,
								kind: a.kind,
								featureKey,
								path: resolvedPath,
								content: a.content,
								contentHash: hash,
								source: data.source,
							},
						});
				upserted.push({ id: row.id, kind: row.kind, featureKey: row.featureKey });
			}
			return c.json({ upserted });
		},
	)
	.post("/sync", zValidator("json", syncBody, validationHook), async (c) => {
		const projectId = c.req.param("id" as never) as string;
		const { direction, featureKey } = c.req.valid("json");
		const result =
			direction === "to-disk"
				? await syncToDisk({ projectId, featureKey })
				: await syncFromDisk({ projectId, featureKey });
		return c.json(result);
	})
	.post("/validate", async (c) => {
		const projectId = c.req.param("id" as never) as string;
		const body = await c.req.json().catch(() => ({}) as { featureKey?: string });
		const result = await validateSddArtifacts(projectId, body.featureKey);
		return c.json(result);
	});
