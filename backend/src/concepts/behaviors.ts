import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../db";
import { BEHAVIOR_CATALOGUE } from "../lib/behaviors";
import { asJson } from "../lib/prisma-json";
import { validationHook } from "../lib/validation-hook";

const createBody = z.object({
	entityId: z.string().min(1),
	kind: z.string().refine((s) => BEHAVIOR_CATALOGUE[s] !== undefined, {
		message: "unknown behavior kind (cf. /api/behaviors)",
	}),
	config: z.record(z.unknown()).default({}),
});

const updateBody = createBody.partial();

export const behaviorsRoutes = new Hono()
	.get("/", async (c) => {
		const projectId = c.req.param("id" as never) as string;
		const items = await prisma.behavior.findMany({
			where: { projectId },
			orderBy: { kind: "asc" },
		});
		return c.json({ items });
	})
	.get("/:bid", async (c) => {
		const { id: projectId, bid } = c.req.param() as Record<string, string>;
		const item = await prisma.behavior.findFirst({
			where: { id: bid, projectId },
		});
		if (!item) return c.json({ error: "not_found" }, 404);
		return c.json({ item });
	})
	.post("/", zValidator("json", createBody, validationHook), async (c) => {
		const projectId = c.req.param("id" as never) as string;
		const data = c.req.valid("json");
		const item = await prisma.behavior.create({
			data: {
				projectId,
				entityId: data.entityId,
				kind: data.kind,
				config: asJson(data.config),
			},
		});
		return c.json({ item }, 201);
	})
	.put("/:bid", zValidator("json", updateBody, validationHook), async (c) => {
		const { id: projectId, bid } = c.req.param() as Record<string, string>;
		const data = c.req.valid("json");
		const item = await prisma.behavior.update({
			where: { id: bid, projectId },
			data: {
				...(data.entityId !== undefined && { entityId: data.entityId }),
				...(data.kind !== undefined && { kind: data.kind }),
				...(data.config !== undefined && { config: asJson(data.config) }),
			},
		});
		return c.json({ item });
	})
	.delete("/:bid", async (c) => {
		const { id: projectId, bid } = c.req.param() as Record<string, string>;
		await prisma.behavior.delete({ where: { id: bid, projectId } });
		return c.json({ ok: true });
	});
