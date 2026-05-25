// HTTP endpoints for the Operation DSL.
// Mounted at /api/projects/:id/operation-dsl

import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../db";
import { validationHook } from "../lib/validation-hook";
import {
	collectOperationEvents,
	collectOperationIntegrations,
	collectOperationPolicies,
	collectOperationReads,
	collectOperationWrites,
} from "../lib/dsl/operation-analyze";
import { operationBodySchema, OPERATION_STEP_KINDS } from "../lib/dsl/operation-dsl";
import { validateOperationBody } from "../lib/dsl/operation-validate";
import { POLICY_RULE_OPS } from "../lib/dsl/policy-dsl";
import { validatePolicyRule } from "../lib/dsl/policy-validate";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function loadProjectCtx(projectId: string) {
	const [entities, policies, integrations, events] = await Promise.all([
		prisma.entity.findMany({ where: { projectId }, select: { name: true } }),
		prisma.policy.findMany({ where: { projectId }, select: { name: true } }),
		prisma.integration.findMany({ where: { projectId }, select: { key: true } }),
		prisma.eventDefinition.findMany({ where: { projectId }, select: { name: true } }),
	]);
	return {
		entityNames: entities.map((e) => e.name),
		policyNames: policies.map((p) => p.name),
		integrationNames: integrations.map((i) => i.key),
		eventNames: events.map((e) => e.name),
	};
}

// ─── Routes ───────────────────────────────────────────────────────────────────

const validateBodyInput = z.object({ steps: z.unknown(), expectedReturn: z.boolean().optional() });
const analyzeBodyInput = z.object({ steps: z.unknown() });
const validatePolicyInput = z.object({ rule: z.unknown() });

export const operationDslRoutes = new Hono()
	// GET /step-kinds
	.get("/step-kinds", (c) => c.json({ kinds: OPERATION_STEP_KINDS }))

	// GET /policy-ops
	.get("/policy-ops", (c) => c.json({ ops: POLICY_RULE_OPS }))

	// POST /validate-body
	.post(
		"/validate-body",
		zValidator("json", validateBodyInput, validationHook),
		async (c) => {
			const projectId = c.req.param("id") as string;
			const { steps, expectedReturn } = c.req.valid("json");

			const project = await prisma.project.findUnique({ where: { id: projectId } });
			if (!project) return c.json({ error: "not_found" }, 404);

			const ctx = { ...(await loadProjectCtx(projectId)), expectedReturn };
			const result = validateOperationBody(steps, ctx);
			return c.json(result);
		},
	)

	// POST /analyze-body
	.post(
		"/analyze-body",
		zValidator("json", analyzeBodyInput, validationHook),
		async (c) => {
			const { steps: rawSteps } = c.req.valid("json");

			const parsed = operationBodySchema.safeParse(rawSteps);
			if (!parsed.success) {
				return c.json(
					{
						error: "invalid_body",
						issues: parsed.error.issues.map((i) => ({
							path: i.path.join("."),
							message: i.message,
						})),
					},
					400,
				);
			}

			return c.json({
				reads: collectOperationReads(parsed.data),
				writes: collectOperationWrites(parsed.data),
				integrations: collectOperationIntegrations(parsed.data),
				events: collectOperationEvents(parsed.data),
				policies: collectOperationPolicies(parsed.data),
			});
		},
	)

	// POST /validate-policy
	.post(
		"/validate-policy",
		zValidator("json", validatePolicyInput, validationHook),
		async (c) => {
			const { rule } = c.req.valid("json");
			const result = validatePolicyRule(rule);
			return c.json(result);
		},
	);
