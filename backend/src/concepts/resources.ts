import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../db";
import { queryConfigSchema } from "../lib/dsl/query-config";
import { asJson } from "../lib/prisma-json";
import { validationHook } from "../lib/validation-hook";

const exposedOpsSchema = z
	.array(z.enum(["list", "read", "create", "update", "delete"]))
	.min(1);

const createBody = z.object({
	entityId: z.string().min(1),
	name: z
		.string()
		.min(1)
		.max(64)
		.regex(/^[a-z0-9][a-z0-9-]*$/, "lowercase kebab-case"),
	exposedOps: exposedOpsSchema,
	queryConfig: queryConfigSchema.optional(),
	defaultPolicyId: z.string().optional(),
});

const updateBody = createBody.partial();

export const resourcesRoutes = new Hono()
	.get("/", async (c) => {
		const projectId = c.req.param("id") as string;
		const items = await prisma.resource.findMany({
			where: { projectId },
			orderBy: { createdAt: "desc" },
		});
		return c.json({ items });
	})
	.get("/:rid", async (c) => {
		const { id: projectId, rid } = c.req.param() as Record<string, string>;
		const item = await prisma.resource.findFirst({
			where: { id: rid, projectId },
		});
		if (!item) return c.json({ error: "not_found" }, 404);
		return c.json({ item });
	})
	.post("/", zValidator("json", createBody, validationHook), async (c) => {
		const projectId = c.req.param("id") as string;
		const data = c.req.valid("json");
		const item = await prisma.resource.create({
			data: {
				projectId,
				entityId: data.entityId,
				name: data.name,
				defaultPolicyId: data.defaultPolicyId,
				exposedOps: asJson(data.exposedOps),
				queryConfig: data.queryConfig ? asJson(data.queryConfig) : undefined,
			},
		});
		return c.json({ item }, 201);
	})
	.put("/:rid", zValidator("json", updateBody, validationHook), async (c) => {
		const { id: projectId, rid } = c.req.param() as Record<string, string>;
		const data = c.req.valid("json");
		const item = await prisma.resource.update({
			where: { id: rid, projectId },
			data: {
				...(data.entityId !== undefined && { entityId: data.entityId }),
				...(data.name !== undefined && { name: data.name }),
				...(data.defaultPolicyId !== undefined && { defaultPolicyId: data.defaultPolicyId }),
				...(data.exposedOps !== undefined && { exposedOps: asJson(data.exposedOps) }),
				...(data.queryConfig !== undefined && { queryConfig: asJson(data.queryConfig) }),
			},
		});
		return c.json({ item });
	})
	.delete("/:rid", async (c) => {
		const { id: projectId, rid } = c.req.param() as Record<string, string>;
		await prisma.resource.delete({ where: { id: rid, projectId } });
		return c.json({ ok: true });
	});
