import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../db";
import { validationHook } from "../lib/validation-hook";

const createBody = z.object({
	scope: z.string().min(1).max(256),
	question: z.string().min(1).max(2_000),
	targetId: z.string().optional(),
});

const updateBody = z.object({
	scope: z.string().min(1).max(256).optional(),
	question: z.string().min(1).max(2_000).optional(),
	answer: z.string().max(10_000).optional(),
	targetId: z.string().optional(),
	status: z.enum(["OPEN", "ANSWERED", "DEFERRED"]).optional(),
});

const answerBody = z.object({ answer: z.string().min(1).max(10_000) });

export const openQuestionsRoutes = new Hono()
	.get("/", async (c) => {
		const projectId = c.req.param("id" as never) as string;
		const status = c.req.query("status");
		const items = await prisma.openQuestion.findMany({
			where: { projectId, ...(status ? { status } : {}) },
			orderBy: { createdAt: "desc" },
		});
		return c.json({ items });
	})
	.get("/:oqid", async (c) => {
		const { id: projectId, oqid } = c.req.param() as Record<string, string>;
		const item = await prisma.openQuestion.findFirst({
			where: { id: oqid, projectId },
		});
		if (!item) return c.json({ error: "not_found" }, 404);
		return c.json({ item });
	})
	.post("/", zValidator("json", createBody, validationHook), async (c) => {
		const projectId = c.req.param("id" as never) as string;
		const data = c.req.valid("json");
		const item = await prisma.openQuestion.create({
			data: { projectId, ...data },
		});
		return c.json({ item }, 201);
	})
	.put("/:oqid", zValidator("json", updateBody, validationHook), async (c) => {
		const { id: projectId, oqid } = c.req.param() as Record<string, string>;
		const data = c.req.valid("json");
		const item = await prisma.openQuestion.update({
			where: { id: oqid, projectId },
			data,
		});
		return c.json({ item });
	})
	.delete("/:oqid", async (c) => {
		const { id: projectId, oqid } = c.req.param() as Record<string, string>;
		await prisma.openQuestion.delete({ where: { id: oqid, projectId } });
		return c.json({ ok: true });
	})
	.post(
		"/:oqid/answer",
		zValidator("json", answerBody, validationHook),
		async (c) => {
			const { id: projectId, oqid } = c.req.param() as Record<string, string>;
			const { answer } = c.req.valid("json");
			const item = await prisma.openQuestion.update({
				where: { id: oqid, projectId },
				data: { answer, status: "ANSWERED" },
			});
			return c.json({ item });
		},
	)
	.post("/:oqid/defer", async (c) => {
		const { id: projectId, oqid } = c.req.param() as Record<string, string>;
		const item = await prisma.openQuestion.update({
			where: { id: oqid, projectId },
			data: { status: "DEFERRED" },
		});
		return c.json({ item });
	});
