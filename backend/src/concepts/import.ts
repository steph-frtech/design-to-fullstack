// Phase 14 — Import routes: HTML + Figma → structural analysis → PlatformSpecProposal.
// Mounted at /api/projects/:id/import
// No LLM calls, no DDL, no hardcoded tokens.

import { Hono } from "hono";
import { prisma } from "../db";
import { analyzeHtml } from "../lib/import/html-analyze";
import { diffHtmlAgainstScreenSpec } from "../lib/import/html-diff";
import { htmlAnalysisToProposal } from "../lib/import/html-to-proposal";
import { resolveFigmaAnalysis, designAnalysisToProposal } from "../lib/import/figma-analyze";
import { asJson } from "../lib/prisma-json";

export const importRoutes = new Hono()

	// ── POST /html/analyze ───────────────────────────────────────────────────
	// Body: { html: string }
	// Returns: { analysis: HtmlAnalysis }
	.post("/html/analyze", async (c) => {
		const body = await c.req.json().catch(() => null);
		if (!body || typeof body.html !== "string") {
			return c.json({ error: "html_required", hint: "Pass { html: '...' } in body." }, 400);
		}
		const analysis = analyzeHtml(body.html as string);
		return c.json({ analysis });
	})

	// ── POST /html/diff ──────────────────────────────────────────────────────
	// Body: { screenSpecId: string, html: string }
	// Returns: { uiDelta }
	.post("/html/diff", async (c) => {
		const projectId = c.req.param("id" as never) as string;
		const body = await c.req.json().catch(() => null);
		if (!body || typeof body.html !== "string") {
			return c.json({ error: "html_required" }, 400);
		}
		if (!body.screenSpecId) {
			return c.json({ error: "screenSpecId_required" }, 400);
		}

		const screenSpec = await prisma.screenSpec.findFirst({
			where: { id: body.screenSpecId as string, projectId },
		});
		if (!screenSpec) return c.json({ error: "screen_spec_not_found" }, 404);

		const analysis = analyzeHtml(body.html as string);
		const uiDelta = diffHtmlAgainstScreenSpec(analysis, screenSpec as unknown as Record<string, unknown>);
		return c.json({ uiDelta });
	})

	// ── POST /html/proposal ──────────────────────────────────────────────────
	// Body: { html: string, featureKey?: string, screenSpecId?: string }
	// Behavior: matches propose_platform_spec — persists as DRAFT and returns row.
	// Returns: { id, proposal }
	.post("/html/proposal", async (c) => {
		const projectId = c.req.param("id" as never) as string;
		const body = await c.req.json().catch(() => null);
		if (!body || typeof body.html !== "string") {
			return c.json({ error: "html_required" }, 400);
		}

		const featureKey = typeof body.featureKey === "string" ? body.featureKey : undefined;
		const screenSpecId = typeof body.screenSpecId === "string" ? body.screenSpecId : undefined;

		const analysis = analyzeHtml(body.html as string);
		const envelope = htmlAnalysisToProposal(analysis, {
			projectId,
			featureKey,
			screenSpecId,
			screenPath: analysis.title
				? `/${analysis.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
				: "/html-import",
		});

		// Persist as DRAFT — same behavior as propose_platform_spec.
		const row = await prisma.platformSpecProposal.create({
			data: {
				projectId,
				featureKey,
				proposal: asJson(envelope.proposal),
				warnings: asJson(envelope.warnings),
				assumptions: asJson(envelope.assumptions),
				openQuestions: asJson(envelope.openQuestions),
				confidenceScore: envelope.confidenceScore,
				rationale: "Derived from HTML import (Phase 14). No entity has been created.",
			},
		});

		return c.json({ id: row.id, proposal: envelope.proposal, envelope });
	})

	// ── POST /figma/analyze ──────────────────────────────────────────────────
	// Body: { figmaJson?: unknown, fileKey?: string }
	// Returns: { analysis } | { error, hint } (501 when not configured)
	.post("/figma/analyze", async (c) => {
		const body = await c.req.json().catch(() => ({}));
		const result = await resolveFigmaAnalysis({
			figmaJson: (body as Record<string, unknown>).figmaJson,
			fileKey: typeof (body as Record<string, unknown>).fileKey === "string"
				? (body as Record<string, unknown>).fileKey as string
				: undefined,
		});

		if ("error" in result) {
			const status = result.error === "figma_not_configured" ? 501 : 400;
			return c.json(result, status as 400 | 501);
		}
		return c.json({ analysis: result });
	})

	// ── POST /design/proposal ────────────────────────────────────────────────
	// Body: { figmaJson?: unknown, fileKey?: string, featureKey?: string }
	// Returns: { id, proposal } | { error, hint }
	.post("/design/proposal", async (c) => {
		const projectId = c.req.param("id" as never) as string;
		const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;

		const analysisResult = await resolveFigmaAnalysis({
			figmaJson: body.figmaJson,
			fileKey: typeof body.fileKey === "string" ? body.fileKey as string : undefined,
		});

		if ("error" in analysisResult) {
			const status = analysisResult.error === "figma_not_configured" ? 501 : 400;
			return c.json(analysisResult, status as 400 | 501);
		}

		const featureKey = typeof body.featureKey === "string" ? body.featureKey : undefined;
		const envelope = designAnalysisToProposal(analysisResult, {
			projectId,
			featureKey,
			screenPath: analysisResult.fileName
				? `/${analysisResult.fileName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
				: "/design-import",
		});

		// Persist as DRAFT
		const row = await prisma.platformSpecProposal.create({
			data: {
				projectId,
				featureKey,
				proposal: asJson(envelope.proposal),
				warnings: asJson(envelope.warnings),
				assumptions: asJson(envelope.assumptions),
				openQuestions: asJson(envelope.openQuestions),
				confidenceScore: envelope.confidenceScore,
				rationale: "Derived from Figma/design import (Phase 14). No entity has been created.",
			},
		});

		return c.json({ id: row.id, proposal: envelope.proposal, envelope });
	});
