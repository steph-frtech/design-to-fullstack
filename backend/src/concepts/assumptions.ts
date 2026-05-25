import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../db";
import { validationHook } from "../lib/validation-hook";

const createBody = z.object({
	scope: z.string().min(1).max(256),
	text: z.string().min(1).max(2_000),
	targetId: z.string().optional(),
});

const updateBody = z.object({
	scope: z.string().min(1).max(256).optional(),
	text: z.string().min(1).max(2_000).optional(),
	targetId: z.string().optional(),
	status: z.enum(["OPEN", "ACCEPTED", "REJECTED"]).optional(),
});

const rejectBody = z.object({ reason: z.string().max(2_000).optional() });

export const assumptionsRoutes = new Hono()
	.get("/", async (c) => {
		const projectId = c.req.param("id" as never) as string;
		const status = c.req.query("status");
		const items = await prisma.assumption.findMany({
			where: { projectId, ...(status ? { status } : {}) },
			orderBy: { createdAt: "desc" },
		});
		return c.json({ items });
	})
	.get("/:aid", async (c) => {
		const { id: projectId, aid } = c.req.param() as Record<string, string>;
		const item = await prisma.assumption.findFirst({
			where: { id: aid, projectId },
		});
		if (!item) return c.json({ error: "not_found" }, 404);
		return c.json({ item });
	})
	.post("/", zValidator("json", createBody, validationHook), async (c) => {
		const projectId = c.req.param("id" as never) as string;
		const data = c.req.valid("json");
		const item = await prisma.assumption.create({
			data: { projectId, ...data },
		});
		return c.json({ item }, 201);
	})
	.put("/:aid", zValidator("json", updateBody, validationHook), async (c) => {
		const { id: projectId, aid } = c.req.param() as Record<string, string>;
		const data = c.req.valid("json");
		const item = await prisma.assumption.update({
			where: { id: aid, projectId },
			data,
		});
		return c.json({ item });
	})
	.delete("/:aid", async (c) => {
		const { id: projectId, aid } = c.req.param() as Record<string, string>;
		await prisma.assumption.delete({ where: { id: aid, projectId } });
		return c.json({ ok: true });
	})
	.post("/:aid/accept", async (c) => {
		const { id: projectId, aid } = c.req.param() as Record<string, string>;
		const item = await prisma.assumption.update({
			where: { id: aid, projectId },
			data: { status: "ACCEPTED" },
		});
		return c.json({ item });
	})
	.post(
		"/:aid/reject",
		zValidator("json", rejectBody, validationHook),
		async (c) => {
			const { id: projectId, aid } = c.req.param() as Record<string, string>;
			const { reason } = c.req.valid("json");
			// We store the reason inside `text` as an appended note to preserve
			// auditability without adding a column for V1.
			const existing = await prisma.assumption.findFirst({
				where: { id: aid, projectId },
			});
			if (!existing) return c.json({ error: "not_found" }, 404);
			const newText = reason
				? `${existing.text}\n\n[REJECTED] ${reason}`
				: existing.text;
			const item = await prisma.assumption.update({
				where: { id: aid, projectId },
				data: { status: "REJECTED", text: newText },
			});
			return c.json({ item });
		},
	);
