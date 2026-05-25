import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../db";
import { asJson } from "../lib/prisma-json";
import {
	type ProductSpecCheck,
	isComplete,
	validateProductSpec,
} from "../lib/product-spec-validation";
import { validationHook } from "../lib/validation-hook";

const createBody = z.object({
	title: z.string().min(1).max(256),
	description: z.string().min(1).max(10_000),
	domain: z.string().max(128).optional(),
	targetUsers: z.array(z.unknown()),
	goals: z.array(z.unknown()),
	nonGoals: z.array(z.unknown()).optional(),
	personas: z.array(z.unknown()).optional(),
	userJourneys: z.array(z.unknown()).optional(),
	businessObjects: z.array(z.unknown()).optional(),
	businessRules: z.array(z.unknown()).optional(),
	glossary: z.array(z.unknown()).optional(),
	assumptions: z.array(z.unknown()).optional(),
	openQuestions: z.array(z.unknown()).optional(),
});

const updateBody = createBody.partial();

export const productSpecsRoutes = new Hono()
	.get("/", async (c) => {
		const projectId = c.req.param("id" as never) as string;
		const items = await prisma.productSpec.findMany({
			where: { projectId },
			orderBy: { updatedAt: "desc" },
		});
		return c.json({ items });
	})
	.get("/:psid", async (c) => {
		const { id: projectId, psid } = c.req.param() as Record<string, string>;
		const item = await prisma.productSpec.findFirst({
			where: { id: psid, projectId },
		});
		if (!item) return c.json({ error: "not_found" }, 404);
		return c.json({ item });
	})
	.post("/", zValidator("json", createBody, validationHook), async (c) => {
		const projectId = c.req.param("id" as never) as string;
		const data = c.req.valid("json");
		const item = await prisma.productSpec.create({
			data: {
				projectId,
				title: data.title,
				description: data.description,
				domain: data.domain,
				targetUsers: asJson(data.targetUsers),
				goals: asJson(data.goals),
				nonGoals: data.nonGoals ? asJson(data.nonGoals) : undefined,
				personas: data.personas ? asJson(data.personas) : undefined,
				userJourneys: data.userJourneys
					? asJson(data.userJourneys)
					: undefined,
				businessObjects: data.businessObjects
					? asJson(data.businessObjects)
					: undefined,
				businessRules: data.businessRules
					? asJson(data.businessRules)
					: undefined,
				glossary: data.glossary ? asJson(data.glossary) : undefined,
				assumptions: data.assumptions ? asJson(data.assumptions) : undefined,
				openQuestions: data.openQuestions
					? asJson(data.openQuestions)
					: undefined,
			},
		});
		return c.json({ item }, 201);
	})
	.put("/:psid", zValidator("json", updateBody, validationHook), async (c) => {
		const { id: projectId, psid } = c.req.param() as Record<string, string>;
		const data = c.req.valid("json");
		// Optional JSON columns are cleared by passing undefined (no-op) or
		// the empty array (kept as JSON []). Setting them to SQL NULL goes via
		// Prisma's JsonNull literal — kept simple here by always coercing to a
		// non-null value when present.
		const updateData: Record<string, unknown> = {};
		if (data.title !== undefined) updateData.title = data.title;
		if (data.description !== undefined) updateData.description = data.description;
		if (data.domain !== undefined) updateData.domain = data.domain;
		if (data.targetUsers !== undefined) updateData.targetUsers = asJson(data.targetUsers);
		if (data.goals !== undefined) updateData.goals = asJson(data.goals);
		if (data.nonGoals !== undefined) updateData.nonGoals = asJson(data.nonGoals);
		if (data.personas !== undefined) updateData.personas = asJson(data.personas);
		if (data.userJourneys !== undefined) updateData.userJourneys = asJson(data.userJourneys);
		if (data.businessObjects !== undefined) updateData.businessObjects = asJson(data.businessObjects);
		if (data.businessRules !== undefined) updateData.businessRules = asJson(data.businessRules);
		if (data.glossary !== undefined) updateData.glossary = asJson(data.glossary);
		if (data.assumptions !== undefined) updateData.assumptions = asJson(data.assumptions);
		if (data.openQuestions !== undefined) updateData.openQuestions = asJson(data.openQuestions);

		const item = await prisma.productSpec.update({
			where: { id: psid, projectId },
			data: updateData as never,
		});
		return c.json({ item });
	})
	.delete("/:psid", async (c) => {
		const { id: projectId, psid } = c.req.param() as Record<string, string>;
		await prisma.productSpec.delete({ where: { id: psid, projectId } });
		return c.json({ ok: true });
	})
	.post("/:psid/validate", async (c) => {
		const { id: projectId, psid } = c.req.param() as Record<string, string>;
		const item = await prisma.productSpec.findFirst({
			where: { id: psid, projectId },
		});
		if (!item) return c.json({ error: "not_found" }, 404);
		const checks: ProductSpecCheck[] = validateProductSpec(item as unknown as Record<string, unknown>);
		return c.json({ checks, complete: isComplete(checks) });
	});
