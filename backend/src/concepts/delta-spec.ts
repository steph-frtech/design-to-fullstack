// HTTP endpoints for the DeltaSpec API.
// Mounted at /api/projects/:id/delta-spec

import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../db";
import { compileProposalToDelta } from "../lib/delta-spec-compile";
import { explainDeltaSpec } from "../lib/delta-spec-explain";
import { validateDeltaSpec } from "../lib/delta-spec-validation";
import { deltaSpecSchema } from "../lib/dsl/delta-spec";
import { applyDeltaSpec } from "../lib/delta-spec-apply";
import type { ProposalContents } from "../lib/platform-proposal";
import { validationHook } from "../lib/validation-hook";
import { runGovernanceChecks } from "../lib/governance/governance-check";
import { emitAuditEvent } from "../lib/governance/audit";

const fromProposalBody = z.object({
	proposalId: z.string().min(1),
});

const validateBody = z.object({
	deltaSpec: z.record(z.unknown()),
});

const explainBody = z.object({
	deltaSpec: z.record(z.unknown()),
});

export const deltaSpecRoutes = new Hono()
	// POST /from-proposal — compile an ACCEPTED PlatformSpecProposal into a DeltaSpec
	.post(
		"/from-proposal",
		zValidator("json", fromProposalBody, validationHook),
		async (c) => {
			const projectId = c.req.param("id" as never) as string;
			const { proposalId } = c.req.valid("json");

			const proposal = await prisma.platformSpecProposal.findFirst({
				where: { id: proposalId, projectId },
			});
			if (!proposal) return c.json({ error: "not_found" }, 404);

			const contents = (proposal.proposal ?? {}) as ProposalContents;
			const deltaSpec = compileProposalToDelta(contents);

			return c.json({ deltaSpec });
		},
	)

	// POST /validate — static lint of a DeltaSpec (no DB write)
	.post(
		"/validate",
		zValidator("json", validateBody, validationHook),
		async (c) => {
			const projectId = c.req.param("id" as never) as string;
			const { deltaSpec } = c.req.valid("json");

			const [existingEntities, existingOperations] = await Promise.all([
				prisma.entity.findMany({ where: { projectId }, select: { name: true } }),
				prisma.operation.findMany({ where: { projectId }, select: { name: true } }),
			]);

			const result = validateDeltaSpec(deltaSpec, {
				existingEntityNames: new Set(existingEntities.map((e) => e.name)),
				existingOperationNames: new Set(existingOperations.map((o) => o.name)),
			});

			return c.json(result);
		},
	)

	// POST /explain — produce a human-readable Markdown summary
	.post(
		"/explain",
		zValidator("json", explainBody, validationHook),
		async (c) => {
			const { deltaSpec: raw } = c.req.valid("json");

			// Best-effort parse — passthrough on unknown keys so explain still works
			const parsed = deltaSpecSchema.passthrough().safeParse(raw);
			const deltaSpec = parsed.success ? parsed.data : (raw as never);

			const markdown = explainDeltaSpec(deltaSpec);

			return c.json({ markdown });
		},
	)

	// POST /apply — open a DRAFT ChangeSet, apply the DeltaSpec, then commit it.
	// The ChangeSet is committed (APPLIED) on success. On hard errors the CS is
	// deleted and the endpoint returns 422.
	// Flow: governance checks → open CS (DRAFT) → applyDeltaSpec → commit CS (APPLIED) | delete CS
	.post(
		"/apply",
		zValidator(
			"json",
			z.object({
				deltaSpec: z.record(z.unknown()),
				message: z.string().min(1).max(512).default("apply delta spec"),
				confirmDeletes: z.boolean().optional(),
			}),
			validationHook,
		),
		async (c) => {
			const projectId = c.req.param("id" as never) as string;
			const { deltaSpec: raw, message, confirmDeletes } = c.req.valid("json");

			// ─── Governance checks (pre-apply) ──────────────────────────
			const govReport = await runGovernanceChecks(projectId, raw, {
				apply: { confirmDeletes },
			});
			if (!govReport.ok) {
				return c.json({ error: "governance_violation", violations: govReport.violations }, 422);
			}

			const parsed = deltaSpecSchema.passthrough().safeParse(raw);
			if (!parsed.success) {
				return c.json({ ok: false, errors: parsed.error.issues }, 400);
			}

			const cs = await prisma.changeSet.create({
				data: { projectId, message, status: "DRAFT" },
			});

			const result = await applyDeltaSpec(prisma, parsed.data, {
				projectId,
				changeSetId: cs.id,
			});

			if (!result.ok) {
				// applyDeltaSpec already cleaned up the CS + revisions on hard error
				return c.json({ ok: false, changeSetId: cs.id, errors: result.errors }, 422);
			}

			await prisma.changeSet.update({
				where: { id: cs.id },
				data: { status: "APPLIED", appliedAt: new Date() },
			});

			// Audit (best-effort)
			void emitAuditEvent({ projectId, action: "apply_delta", target: { changeSetId: cs.id, message }, metadata: { appliedCount: result.appliedCount } });

			return c.json({
				ok: true,
				changeSetId: cs.id,
				applied: result.appliedCount,
				createdIds: result.createdIds,
				skipped: result.errors ?? [],
			});
		},
	);
