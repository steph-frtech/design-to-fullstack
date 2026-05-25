// contracts.ts — HTTP routes for the contracts compilation layer.
// Mounted at /api/projects/:id/contracts

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { getRuntimeTarget, setRuntimeTarget } from "../lib/contracts/runtime-target";
import { compileBackendContract } from "../lib/contracts/compile-backend";
import { compileFrontendContract } from "../lib/contracts/compile-frontend";
import { compileSharedContract } from "../lib/contracts/compile-shared";
import { validateContracts } from "../lib/contracts/validate-contracts";
import { explainContracts } from "../lib/contracts/explain-contracts";
import { validationHook } from "../lib/validation-hook";

const runtimeTargetBody = z.object({
	name: z.string().min(1).optional(),
	backend: z
		.object({
			framework: z.string(),
			versionPolicy: z.string().optional(),
			runtime: z.string().optional(),
			apiStyle: z.string().optional(),
		})
		.optional(),
	frontend: z
		.object({
			framework: z.string(),
			version: z.string().optional(),
			router: z.string().optional(),
			rendering: z.string().optional(),
		})
		.optional(),
	auth: z
		.object({
			provider: z.string(),
			basePath: z.string().optional(),
		})
		.optional(),
	database: z
		.object({
			provider: z.string(),
			orm: z.string().optional(),
		})
		.optional(),
	packageManager: z.string().optional(),
});

export const contractsRoutes = new Hono()

	// GET /runtime-target
	.get("/runtime-target", async (c) => {
		const projectId = c.req.param("id") as string;
		const name = c.req.query("name");
		const result = await getRuntimeTarget(projectId, name);
		return c.json({ target: result, source: result.source });
	})

	// PUT /runtime-target
	.put(
		"/runtime-target",
		zValidator("json", runtimeTargetBody, validationHook),
		async (c) => {
			const projectId = c.req.param("id") as string;
			const body = c.req.valid("json");
			const result = await setRuntimeTarget(projectId, body);
			if (!result.ok) {
				return c.json(result, 409);
			}
			return c.json(result);
		},
	)

	// POST /compile/backend
	.post("/compile/backend", async (c) => {
		const projectId = c.req.param("id") as string;
		const contract = await compileBackendContract(projectId);
		return c.json({ ok: true, contract });
	})

	// POST /compile/frontend
	.post("/compile/frontend", async (c) => {
		const projectId = c.req.param("id") as string;
		const contract = await compileFrontendContract(projectId);
		return c.json({ ok: true, contract });
	})

	// POST /compile/shared
	.post("/compile/shared", async (c) => {
		const projectId = c.req.param("id") as string;
		const contract = await compileSharedContract(projectId);
		return c.json({ ok: true, contract });
	})

	// GET /validate
	.get("/validate", async (c) => {
		const projectId = c.req.param("id") as string;
		const result = await validateContracts(projectId);
		return c.json(result);
	})

	// GET /explain
	.get("/explain", async (c) => {
		const projectId = c.req.param("id") as string;
		const result = await explainContracts(projectId);
		return c.json(result);
	});
