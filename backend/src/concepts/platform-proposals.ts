import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../db";
import {
	buildProposalSkeleton,
	type ProposalEnvelope,
} from "../lib/platform-proposal";
import { validateProposalEnvelope } from "../lib/platform-proposal-validation";
import { asJson } from "../lib/prisma-json";
import { validationHook } from "../lib/validation-hook";

const createBody = z.object({
	featureKey: z.string().min(1).max(128).optional(),
	proposal: z.record(z.unknown()),
	warnings: z.array(z.unknown()).optional(),
	assumptions: z.array(z.unknown()).optional(),
	openQuestions: z.array(z.unknown()).optional(),
	confidenceScore: z.number().min(0).max(1).optional(),
	rationale: z.string().optional(),
});

const updateBody = createBody.partial();

const acceptBody = z.object({ rationale: z.string().optional() });
const rejectBody = z.object({ rationale: z.string().optional() });

export const platformProposalsRoutes = new Hono()
	.get("/", async (c) => {
		const projectId = c.req.param("id" as never) as string;
		const status = c.req.query("status");
		const featureKey = c.req.query("featureKey");
		const items = await prisma.platformSpecProposal.findMany({
			where: {
				projectId,
				...(status ? { status } : {}),
				...(featureKey !== undefined ? { featureKey } : {}),
			},
			orderBy: { updatedAt: "desc" },
		});
		return c.json({ items });
	})
	.get("/:ppid", async (c) => {
		const { id: projectId, ppid } = c.req.param() as Record<string, string>;
		const item = await prisma.platformSpecProposal.findFirst({
			where: { id: ppid, projectId },
		});
		if (!item) return c.json({ error: "not_found" }, 404);
		return c.json({ item });
	})
	.post("/", zValidator("json", createBody, validationHook), async (c) => {
		const projectId = c.req.param("id" as never) as string;
		const data = c.req.valid("json");
		const item = await prisma.platformSpecProposal.create({
			data: {
				projectId,
				featureKey: data.featureKey,
				proposal: asJson(data.proposal),
				warnings: data.warnings ? asJson(data.warnings) : undefined,
				assumptions: data.assumptions ? asJson(data.assumptions) : undefined,
				openQuestions: data.openQuestions
					? asJson(data.openQuestions)
					: undefined,
				confidenceScore: data.confidenceScore,
				rationale: data.rationale,
			},
		});
		return c.json({ item }, 201);
	})
	.put("/:ppid", zValidator("json", updateBody, validationHook), async (c) => {
		const { id: projectId, ppid } = c.req.param() as Record<string, string>;
		const data = c.req.valid("json");
		const updateData: Record<string, unknown> = {};
		if (data.featureKey !== undefined) updateData.featureKey = data.featureKey;
		if (data.proposal !== undefined) updateData.proposal = asJson(data.proposal);
		if (data.warnings !== undefined) updateData.warnings = asJson(data.warnings);
		if (data.assumptions !== undefined)
			updateData.assumptions = asJson(data.assumptions);
		if (data.openQuestions !== undefined)
			updateData.openQuestions = asJson(data.openQuestions);
		if (data.confidenceScore !== undefined)
			updateData.confidenceScore = data.confidenceScore;
		if (data.rationale !== undefined) updateData.rationale = data.rationale;
		const item = await prisma.platformSpecProposal.update({
			where: { id: ppid, projectId },
			data: updateData as never,
		});
		return c.json({ item });
	})
	.delete("/:ppid", async (c) => {
		const { id: projectId, ppid } = c.req.param() as Record<string, string>;
		await prisma.platformSpecProposal.delete({
			where: { id: ppid, projectId },
		});
		return c.json({ ok: true });
	})
	.post(
		"/:ppid/accept",
		zValidator("json", acceptBody, validationHook),
		async (c) => {
			const { id: projectId, ppid } = c.req.param() as Record<string, string>;
			const { rationale } = c.req.valid("json");
			const item = await prisma.platformSpecProposal.update({
				where: { id: ppid, projectId },
				data: { status: "ACCEPTED", rationale },
			});
			return c.json({ item });
		},
	)
	.post(
		"/:ppid/reject",
		zValidator("json", rejectBody, validationHook),
		async (c) => {
			const { id: projectId, ppid } = c.req.param() as Record<string, string>;
			const { rationale } = c.req.valid("json");
			const item = await prisma.platformSpecProposal.update({
				where: { id: ppid, projectId },
				data: { status: "REJECTED", rationale },
			});
			return c.json({ item });
		},
	)
	// Synthesize a fresh skeleton + store it as DRAFT.
	.post("/synthesize", async (c) => {
		const projectId = c.req.param("id" as never) as string;
		const body = (await c.req.json().catch(() => ({}))) as {
			featureKey?: string;
		};
		const envelope: ProposalEnvelope = await buildProposalSkeleton({
			projectId,
			featureKey: body.featureKey,
		});
		const row = await prisma.platformSpecProposal.create({
			data: {
				projectId,
				featureKey: body.featureKey,
				proposal: asJson(envelope.proposal),
				warnings: asJson(envelope.warnings),
				assumptions: asJson(envelope.assumptions),
				openQuestions: asJson(envelope.openQuestions),
				confidenceScore: envelope.confidenceScore,
			},
		});
		return c.json({ id: row.id, envelope });
	})
	// Lint a proposal envelope (no DB write).
	.post("/:ppid/validate", async (c) => {
		const { id: projectId, ppid } = c.req.param() as Record<string, string>;
		const item = await prisma.platformSpecProposal.findFirst({
			where: { id: ppid, projectId },
		});
		if (!item) return c.json({ error: "not_found" }, 404);
		const existingEntities = await prisma.entity.findMany({
			where: { projectId },
			select: { name: true },
		});
		const existingOps = await prisma.operation.findMany({
			where: { projectId },
			select: { name: true },
		});
		const envelope: ProposalEnvelope = {
			proposal: (item.proposal ?? {}) as never,
			warnings: (item.warnings ?? []) as never,
			assumptions: (item.assumptions ?? []) as never,
			openQuestions: (item.openQuestions ?? []) as never,
			confidenceScore: item.confidenceScore ?? 0,
		};
		const checks = validateProposalEnvelope(
			envelope,
			new Set(existingEntities.map((e) => e.name)),
			new Set(existingOps.map((o) => o.name)),
		);
		return c.json({ checks });
	});
