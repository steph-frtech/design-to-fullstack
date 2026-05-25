import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../db";
import { asJson } from "../lib/prisma-json";
import { validationHook } from "../lib/validation-hook";

const cascadeSchema = z.object({
	onDelete: z.enum(["CASCADE", "SET_NULL", "RESTRICT"]),
});

const createBody = z.object({
	fromEntityId: z.string().min(1),
	toEntityId: z.string().min(1),
	name: z.string().min(1).max(64),
	kind: z.enum(["ONE_TO_ONE", "ONE_TO_MANY", "MANY_TO_MANY"]),
	fromField: z.string().optional(),
	toField: z.string().optional(),
	required: z.boolean().default(false),
	cascade: cascadeSchema.optional(),
});

const updateBody = createBody.partial();

export const relationsRoutes = new Hono()
	.get("/", async (c) => {
		const projectId = c.req.param("id" as never) as string;
		const items = await prisma.entityRelation.findMany({
			where: { projectId },
			orderBy: { createdAt: "desc" },
		});
		return c.json({ items });
	})
	.get("/:rid", async (c) => {
		const { id: projectId, rid } = c.req.param() as Record<string, string>;
		const item = await prisma.entityRelation.findFirst({
			where: { id: rid, projectId },
		});
		if (!item) return c.json({ error: "not_found" }, 404);
		return c.json({ item });
	})
	.post("/", zValidator("json", createBody, validationHook), async (c) => {
		const projectId = c.req.param("id" as never) as string;
		const data = c.req.valid("json");
		const item = await prisma.entityRelation.create({
			data: {
				projectId,
				fromEntityId: data.fromEntityId,
				toEntityId: data.toEntityId,
				name: data.name,
				kind: data.kind,
				fromField: data.fromField,
				toField: data.toField,
				required: data.required,
				cascade: data.cascade ? asJson(data.cascade) : undefined,
			},
		});
		return c.json({ item }, 201);
	})
	.put("/:rid", zValidator("json", updateBody, validationHook), async (c) => {
		const { id: projectId, rid } = c.req.param() as Record<string, string>;
		const data = c.req.valid("json");
		const item = await prisma.entityRelation.update({
			where: { id: rid, projectId },
			data: {
				...(data.fromEntityId !== undefined && { fromEntityId: data.fromEntityId }),
				...(data.toEntityId !== undefined && { toEntityId: data.toEntityId }),
				...(data.name !== undefined && { name: data.name }),
				...(data.kind !== undefined && { kind: data.kind }),
				...(data.fromField !== undefined && { fromField: data.fromField }),
				...(data.toField !== undefined && { toField: data.toField }),
				...(data.required !== undefined && { required: data.required }),
				...(data.cascade !== undefined && { cascade: asJson(data.cascade) }),
			},
		});
		return c.json({ item });
	})
	.delete("/:rid", async (c) => {
		const { id: projectId, rid } = c.req.param() as Record<string, string>;
		await prisma.entityRelation.delete({ where: { id: rid, projectId } });
		return c.json({ ok: true });
	});
