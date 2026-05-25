import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../db";
import { asJson } from "../lib/prisma-json";
import { validationHook } from "../lib/validation-hook";

const createBody = z.object({
	key: z
		.string()
		.min(1)
		.max(64)
		.regex(/^[A-Z][A-Z0-9_-]*$/, "uppercase + digits + - or _"),
	title: z.string().min(1).max(256),
	description: z.string().min(1).max(10_000),
	productSpecId: z.string().optional(),
	priority: z.string().max(64).optional(),
	status: z.enum(["DRAFT", "ACCEPTED", "MAPPED", "REJECTED"]).optional(),
	acceptanceCriteria: z.array(z.unknown()).optional(),
	source: z.enum(["natural", "speckit", "imported", "manual"]).optional(),
});

const updateBody = createBody.partial();

const extractBody = z.object({
	featureKey: z.string().min(1),
	requirements: z
		.array(
			z.object({
				key: z.string().min(1).max(64),
				title: z.string().min(1).max(256),
				description: z.string().min(1).max(10_000),
				priority: z.string().max(64).optional(),
				acceptanceCriteria: z.array(z.unknown()).optional(),
			}),
		)
		.min(1),
	source: z.enum(["natural", "speckit", "imported", "manual"]).default("speckit"),
});

export const requirementsRoutes = new Hono()
	.get("/", async (c) => {
		const projectId = c.req.param("id" as never) as string;
		const status = c.req.query("status");
		const priority = c.req.query("priority");
		const productSpecId = c.req.query("productSpecId");
		const items = await prisma.requirement.findMany({
			where: {
				projectId,
				...(status ? { status } : {}),
				...(priority ? { priority } : {}),
				...(productSpecId ? { productSpecId } : {}),
			},
			orderBy: { key: "asc" },
			include: { _count: { select: { mappings: true } } },
		});
		return c.json({ items });
	})
	.get("/:rid", async (c) => {
		const { id: projectId, rid } = c.req.param() as Record<string, string>;
		const item = await prisma.requirement.findFirst({
			where: { id: rid, projectId },
			include: { mappings: true },
		});
		if (!item) return c.json({ error: "not_found" }, 404);
		return c.json({ item });
	})
	.post("/", zValidator("json", createBody, validationHook), async (c) => {
		const projectId = c.req.param("id" as never) as string;
		const data = c.req.valid("json");
		const item = await prisma.requirement.create({
			data: {
				projectId,
				key: data.key,
				title: data.title,
				description: data.description,
				productSpecId: data.productSpecId,
				priority: data.priority,
				status: data.status ?? "DRAFT",
				acceptanceCriteria: data.acceptanceCriteria
					? asJson(data.acceptanceCriteria)
					: undefined,
				source: data.source,
			},
		});
		return c.json({ item }, 201);
	})
	.put("/:rid", zValidator("json", updateBody, validationHook), async (c) => {
		const { id: projectId, rid } = c.req.param() as Record<string, string>;
		const data = c.req.valid("json");
		const update: Record<string, unknown> = {};
		for (const k of ["key", "title", "description", "productSpecId", "priority", "status", "source"] as const) {
			const v = (data as Record<string, unknown>)[k];
			if (v !== undefined) update[k] = v;
		}
		if (data.acceptanceCriteria !== undefined)
			update.acceptanceCriteria = asJson(data.acceptanceCriteria);
		const item = await prisma.requirement.update({
			where: { id: rid, projectId },
			data: update as never,
		});
		return c.json({ item });
	})
	.delete("/:rid", async (c) => {
		const { id: projectId, rid } = c.req.param() as Record<string, string>;
		await prisma.requirement.delete({ where: { id: rid, projectId } });
		return c.json({ ok: true });
	})
	.post("/:rid/accept", async (c) => {
		const { id: projectId, rid } = c.req.param() as Record<string, string>;
		const item = await prisma.requirement.update({
			where: { id: rid, projectId },
			data: { status: "ACCEPTED" },
		});
		return c.json({ item });
	})
	.post("/:rid/reject", async (c) => {
		const { id: projectId, rid } = c.req.param() as Record<string, string>;
		const item = await prisma.requirement.update({
			where: { id: rid, projectId },
			data: { status: "REJECTED" },
		});
		return c.json({ item });
	})
	// Bulk upsert from extraction agent
	.post("/extract", zValidator("json", extractBody, validationHook), async (c) => {
		const projectId = c.req.param("id" as never) as string;
		const data = c.req.valid("json");
		const upserted: { id: string; key: string; created: boolean }[] = [];
		for (const r of data.requirements) {
			const existing = await prisma.requirement.findUnique({
				where: { projectId_key: { projectId, key: r.key } },
			});
			if (existing) {
				const updated = await prisma.requirement.update({
					where: { id: existing.id },
					data: {
						title: r.title,
						description: r.description,
						priority: r.priority,
						acceptanceCriteria: r.acceptanceCriteria
							? asJson(r.acceptanceCriteria)
							: undefined,
						source: data.source,
					},
				});
				upserted.push({ id: updated.id, key: updated.key, created: false });
			} else {
				const created = await prisma.requirement.create({
					data: {
						projectId,
						key: r.key,
						title: r.title,
						description: r.description,
						priority: r.priority,
						acceptanceCriteria: r.acceptanceCriteria
							? asJson(r.acceptanceCriteria)
							: undefined,
						source: data.source,
					},
				});
				upserted.push({ id: created.id, key: created.key, created: true });
			}
		}
		return c.json({ upserted, featureKey: data.featureKey });
	});
