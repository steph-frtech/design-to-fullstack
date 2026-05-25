import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../db";
import { asJson } from "../lib/prisma-json";
import { validationHook } from "../lib/validation-hook";

const createBody = z.object({
	key: z.string().min(1).max(64),
	provider: z.string().min(1).max(64),
	capabilities: z.array(z.string()).min(1),
	configSchema: z.record(z.unknown()),
	secretRefs: z.record(z.string()).optional(),
});

const updateBody = createBody.partial();

export const integrationsRoutes = new Hono()
	.get("/", async (c) => {
		const projectId = c.req.param("id" as never) as string;
		const items = await prisma.integration.findMany({
			where: { projectId },
			orderBy: { key: "asc" },
		});
		return c.json({ items });
	})
	.get("/:iid", async (c) => {
		const { id: projectId, iid } = c.req.param() as Record<string, string>;
		const item = await prisma.integration.findFirst({
			where: { id: iid, projectId },
		});
		if (!item) return c.json({ error: "not_found" }, 404);
		return c.json({ item });
	})
	.post("/", zValidator("json", createBody, validationHook), async (c) => {
		const projectId = c.req.param("id" as never) as string;
		const data = c.req.valid("json");
		const item = await prisma.integration.create({
			data: {
				projectId,
				key: data.key,
				provider: data.provider,
				capabilities: asJson(data.capabilities),
				configSchema: asJson(data.configSchema),
				secretRefs: data.secretRefs ? asJson(data.secretRefs) : undefined,
			},
		});
		return c.json({ item }, 201);
	})
	.put("/:iid", zValidator("json", updateBody, validationHook), async (c) => {
		const { id: projectId, iid } = c.req.param() as Record<string, string>;
		const data = c.req.valid("json");
		const item = await prisma.integration.update({
			where: { id: iid, projectId },
			data: {
				...(data.key !== undefined && { key: data.key }),
				...(data.provider !== undefined && { provider: data.provider }),
				...(data.capabilities !== undefined && { capabilities: asJson(data.capabilities) }),
				...(data.configSchema !== undefined && { configSchema: asJson(data.configSchema) }),
				...(data.secretRefs !== undefined && { secretRefs: asJson(data.secretRefs) }),
			},
		});
		return c.json({ item });
	})
	.delete("/:iid", async (c) => {
		const { id: projectId, iid } = c.req.param() as Record<string, string>;
		await prisma.integration.delete({ where: { id: iid, projectId } });
		return c.json({ ok: true });
	});
