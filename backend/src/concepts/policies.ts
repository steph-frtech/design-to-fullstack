import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../db";
import { policyRuleSchema } from "../lib/dsl/policy";
import { asJson } from "../lib/prisma-json";
import { validationHook } from "../lib/validation-hook";

const createBody = z.object({
	name: z.string().min(1).max(64),
	scope: z.enum(["RESOURCE", "OPERATION", "ENTITY", "FIELD"]),
	resourceId: z.string().optional(),
	operationId: z.string().optional(),
	entityId: z.string().optional(),
	fieldName: z.string().optional(),
	effect: z.enum(["ALLOW", "DENY"]).default("ALLOW"),
	rule: policyRuleSchema,
});

const updateBody = createBody.partial();

export const policiesRoutes = new Hono()
	.get("/", async (c) => {
		const projectId = c.req.param("id" as never) as string;
		const items = await prisma.policy.findMany({
			where: { projectId },
			orderBy: { name: "asc" },
		});
		return c.json({ items });
	})
	.get("/:pid", async (c) => {
		const { id: projectId, pid } = c.req.param() as Record<string, string>;
		const item = await prisma.policy.findFirst({
			where: { id: pid, projectId },
		});
		if (!item) return c.json({ error: "not_found" }, 404);
		return c.json({ item });
	})
	.post("/", zValidator("json", createBody, validationHook), async (c) => {
		const projectId = c.req.param("id" as never) as string;
		const data = c.req.valid("json");
		const item = await prisma.policy.create({
			data: {
				projectId,
				name: data.name,
				scope: data.scope,
				resourceId: data.resourceId,
				operationId: data.operationId,
				entityId: data.entityId,
				fieldName: data.fieldName,
				effect: data.effect,
				rule: asJson(data.rule),
			},
		});
		return c.json({ item }, 201);
	})
	.put("/:pid", zValidator("json", updateBody, validationHook), async (c) => {
		const { id: projectId, pid } = c.req.param() as Record<string, string>;
		const data = c.req.valid("json");
		const item = await prisma.policy.update({
			where: { id: pid, projectId },
			data: {
				...(data.name !== undefined && { name: data.name }),
				...(data.scope !== undefined && { scope: data.scope }),
				...(data.resourceId !== undefined && { resourceId: data.resourceId }),
				...(data.operationId !== undefined && { operationId: data.operationId }),
				...(data.entityId !== undefined && { entityId: data.entityId }),
				...(data.fieldName !== undefined && { fieldName: data.fieldName }),
				...(data.effect !== undefined && { effect: data.effect }),
				...(data.rule !== undefined && { rule: asJson(data.rule) }),
			},
		});
		return c.json({ item });
	})
	.delete("/:pid", async (c) => {
		const { id: projectId, pid } = c.req.param() as Record<string, string>;
		await prisma.policy.delete({ where: { id: pid, projectId } });
		return c.json({ ok: true });
	});
