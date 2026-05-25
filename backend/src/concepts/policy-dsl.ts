// HTTP endpoints for the Policy DSL.
// Mounted at /api/projects/:id/policy-dsl

import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../db";
import { validationHook } from "../lib/validation-hook";
import { evalPolicyRule } from "../lib/dsl/policy-eval";
import { policyRuleSchema } from "../lib/dsl/policy-dsl";
import { validatePolicyRule } from "../lib/dsl/policy-validate";

// ─── Routes ───────────────────────────────────────────────────────────────────

const validateRuleInput = z.object({ rule: z.unknown() });
const evalRuleInput = z.object({
	rule: z.unknown(),
	scope: z.record(z.unknown()).default({}),
});

export const policyDslRoutes = new Hono()
	// POST /validate-rule
	.post(
		"/validate-rule",
		zValidator("json", validateRuleInput, validationHook),
		async (c) => {
			const projectId = c.req.param("id") as string;
			const { rule } = c.req.valid("json");

			const project = await prisma.project.findUnique({ where: { id: projectId } });
			if (!project) return c.json({ error: "not_found" }, 404);

			const result = validatePolicyRule(rule);
			return c.json(result);
		},
	)

	// POST /eval-rule
	.post(
		"/eval-rule",
		zValidator("json", evalRuleInput, validationHook),
		async (c) => {
			const { rule: rawRule, scope } = c.req.valid("json");

			const parsed = policyRuleSchema.safeParse(rawRule);
			if (!parsed.success) {
				return c.json(
					{
						error: "invalid_rule",
						issues: parsed.error.issues.map((i) => ({
							path: i.path.join("."),
							message: i.message,
						})),
					},
					400,
				);
			}

			try {
				const value = evalPolicyRule(parsed.data, scope as never);
				return c.json({ value });
			} catch (err) {
				return c.json({ error: (err as Error).message }, 400);
			}
		},
	);
