// HTTP endpoints for the Expr DSL.
// Mounted at /api/projects/:id/expr

import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { exprSchema } from "../lib/dsl/expr-ast";
import { validateExpr } from "../lib/dsl/expr-validate";
import { evalExpr } from "../lib/dsl/expr-eval";
import { collectExprCalls, collectExprRefs, inferExprType } from "../lib/dsl/expr-analyze";
import { validationHook } from "../lib/validation-hook";

const validateBody = z.object({
	expr: z.unknown(),
	stepAliases: z.array(z.string()).optional(),
});

const evalBody = z.object({
	expr: z.unknown(),
	scope: z.record(z.unknown()).default({}),
});

const analyzeBody = z.object({
	expr: z.unknown(),
});

export const exprRoutes = new Hono()
	// POST /validate
	.post(
		"/validate",
		zValidator("json", validateBody, validationHook),
		(c) => {
			const { expr, stepAliases } = c.req.valid("json");
			const result = validateExpr(expr, {
				availableStepAliases: stepAliases,
			});
			return c.json(result);
		},
	)

	// POST /eval
	.post(
		"/eval",
		zValidator("json", evalBody, validationHook),
		(c) => {
			const { expr: rawExpr, scope } = c.req.valid("json");

			const parsed = exprSchema.safeParse(rawExpr);
			if (!parsed.success) {
				return c.json(
					{
						error: "invalid_expr",
						issues: parsed.error.issues.map((i) => ({
							path: i.path.join("."),
							message: i.message,
						})),
					},
					400,
				);
			}

			try {
				const value = evalExpr(parsed.data, scope as never);
				return c.json({ value });
			} catch (err) {
				return c.json({ error: (err as Error).message }, 400);
			}
		},
	)

	// POST /analyze
	.post(
		"/analyze",
		zValidator("json", analyzeBody, validationHook),
		(c) => {
			const { expr: rawExpr } = c.req.valid("json");

			const parsed = exprSchema.safeParse(rawExpr);
			if (!parsed.success) {
				return c.json(
					{
						error: "invalid_expr",
						issues: parsed.error.issues.map((i) => ({
							path: i.path.join("."),
							message: i.message,
						})),
					},
					400,
				);
			}

			return c.json({
				refs: collectExprRefs(parsed.data),
				calls: collectExprCalls(parsed.data),
				inferredType: inferExprType(parsed.data),
			});
		},
	);
