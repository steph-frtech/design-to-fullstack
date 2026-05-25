import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../db";
import { validationHook } from "../lib/validation-hook";

const TARGET_TYPES = [
	"Entity",
	"Attribute",
	"Operation",
	"Policy",
	"Screen",
	"Field",
	"TestScenario",
	"Resource",
	"Workflow",
	"Component",
	"Form",
	"EntityRelation",
	"Integration",
	"Trigger",
	"Behavior",
] as const;

const createBody = z.object({
	requirementId: z.string().min(1),
	targetType: z.enum(TARGET_TYPES),
	targetId: z.string().min(1),
	confidence: z.number().min(0).max(1).optional(),
	rationale: z.string().max(2_000).optional(),
});

const updateBody = createBody.partial();

const bulkBody = z.object({
	mappings: z.array(createBody).min(1),
});

async function autoTransitionStatus(requirementId: string): Promise<void> {
	const req = await prisma.requirement.findUnique({
		where: { id: requirementId },
		include: { _count: { select: { mappings: true } } },
	});
	if (!req) return;
	const n = req._count.mappings;
	// First mapping → MAPPED (unless already REJECTED).
	if (n > 0 && req.status !== "MAPPED" && req.status !== "REJECTED") {
		await prisma.requirement.update({
			where: { id: requirementId },
			data: { status: "MAPPED" },
		});
	}
	// Last mapping gone → MAPPED rewinds to ACCEPTED.
	if (n === 0 && req.status === "MAPPED") {
		await prisma.requirement.update({
			where: { id: requirementId },
			data: { status: "ACCEPTED" },
		});
	}
}

export const requirementMappingsRoutes = new Hono()
	.get("/", async (c) => {
		const projectId = c.req.param("id" as never) as string;
		const requirementId = c.req.query("requirementId");
		const targetType = c.req.query("targetType");
		const items = await prisma.requirementMapping.findMany({
			where: {
				projectId,
				...(requirementId ? { requirementId } : {}),
				...(targetType ? { targetType } : {}),
			},
			orderBy: { createdAt: "desc" },
		});
		return c.json({ items });
	})
	.get("/:mid", async (c) => {
		const { id: projectId, mid } = c.req.param() as Record<string, string>;
		const item = await prisma.requirementMapping.findFirst({
			where: { id: mid, projectId },
		});
		if (!item) return c.json({ error: "not_found" }, 404);
		return c.json({ item });
	})
	.post("/", zValidator("json", createBody, validationHook), async (c) => {
		const projectId = c.req.param("id" as never) as string;
		const data = c.req.valid("json");
		// Ensure the requirement belongs to this project.
		const req = await prisma.requirement.findFirst({
			where: { id: data.requirementId, projectId },
		});
		if (!req)
			return c.json({ error: "requirement_not_found_in_project" }, 404);
		const item = await prisma.requirementMapping.create({
			data: { projectId, ...data },
		});
		await autoTransitionStatus(data.requirementId);
		return c.json({ item }, 201);
	})
	.put("/:mid", zValidator("json", updateBody, validationHook), async (c) => {
		const { id: projectId, mid } = c.req.param() as Record<string, string>;
		const data = c.req.valid("json");
		const item = await prisma.requirementMapping.update({
			where: { id: mid, projectId },
			data,
		});
		return c.json({ item });
	})
	.delete("/:mid", async (c) => {
		const { id: projectId, mid } = c.req.param() as Record<string, string>;
		const existing = await prisma.requirementMapping.findFirst({
			where: { id: mid, projectId },
		});
		await prisma.requirementMapping.delete({ where: { id: mid, projectId } });
		if (existing) await autoTransitionStatus(existing.requirementId);
		return c.json({ ok: true });
	})
	// Bulk upsert
	.post("/bulk", zValidator("json", bulkBody, validationHook), async (c) => {
		const projectId = c.req.param("id" as never) as string;
		const data = c.req.valid("json");
		const created: { id: string; requirementId: string; targetType: string; targetId: string }[] = [];
		for (const m of data.mappings) {
			// Verify the requirement belongs to this project, skip otherwise.
			const req = await prisma.requirement.findFirst({
				where: { id: m.requirementId, projectId },
			});
			if (!req) continue;
			// De-dupe: skip if (requirementId, targetType, targetId) already exists.
			const existing = await prisma.requirementMapping.findFirst({
				where: {
					projectId,
					requirementId: m.requirementId,
					targetType: m.targetType,
					targetId: m.targetId,
				},
			});
			if (existing) continue;
			const row = await prisma.requirementMapping.create({
				data: { projectId, ...m },
			});
			created.push({
				id: row.id,
				requirementId: row.requirementId,
				targetType: row.targetType,
				targetId: row.targetId,
			});
			await autoTransitionStatus(m.requirementId);
		}
		return c.json({ created });
	});
