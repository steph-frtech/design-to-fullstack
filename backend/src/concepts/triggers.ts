import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../db";
import { asJson } from "../lib/prisma-json";
import { validationHook } from "../lib/validation-hook";

const sourceSchema = z.union([
	z.object({ event: z.string().min(1) }),
	z.object({ cron: z.string().min(1) }),
	z.object({
		path: z.string().min(1),
		method: z.enum(["GET", "POST", "PUT", "DELETE"]),
		verify: z.string().optional(),
	}),
]);

const createBody = z.object({
	name: z.string().min(1).max(64),
	kind: z.enum(["EVENT", "SCHEDULE", "WEBHOOK"]),
	source: sourceSchema,
	operationId: z.string().min(1),
	inputMapping: z.record(z.unknown()).optional(),
});

const updateBody = createBody.partial();

export const triggersRoutes = new Hono()
	.get("/", async (c) => {
		const projectId = c.req.param("id" as never) as string;
		const items = await prisma.trigger.findMany({
			where: { projectId },
			orderBy: { name: "asc" },
		});
		return c.json({ items });
	})
	.get("/:tid", async (c) => {
		const { id: projectId, tid } = c.req.param() as Record<string, string>;
		const item = await prisma.trigger.findFirst({
			where: { id: tid, projectId },
		});
		if (!item) return c.json({ error: "not_found" }, 404);
		return c.json({ item });
	})
	.post("/", zValidator("json", createBody, validationHook), async (c) => {
		const projectId = c.req.param("id" as never) as string;
		const data = c.req.valid("json");
		const item = await prisma.trigger.create({
			data: {
				projectId,
				name: data.name,
				kind: data.kind,
				operationId: data.operationId,
				source: asJson(data.source),
				inputMapping: data.inputMapping ? asJson(data.inputMapping) : undefined,
			},
		});
		return c.json({ item }, 201);
	})
	.put("/:tid", zValidator("json", updateBody, validationHook), async (c) => {
		const { id: projectId, tid } = c.req.param() as Record<string, string>;
		const data = c.req.valid("json");
		const item = await prisma.trigger.update({
			where: { id: tid, projectId },
			data: {
				...(data.name !== undefined && { name: data.name }),
				...(data.kind !== undefined && { kind: data.kind }),
				...(data.operationId !== undefined && { operationId: data.operationId }),
				...(data.source !== undefined && { source: asJson(data.source) }),
				...(data.inputMapping !== undefined && { inputMapping: asJson(data.inputMapping) }),
			},
		});
		return c.json({ item });
	})
	.delete("/:tid", async (c) => {
		const { id: projectId, tid } = c.req.param() as Record<string, string>;
		await prisma.trigger.delete({ where: { id: tid, projectId } });
		return c.json({ ok: true });
	});
