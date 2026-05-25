import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../db";
import { operationStepsSchema } from "../lib/dsl/steps";
import { asJson } from "../lib/prisma-json";
import { validationHook } from "../lib/validation-hook";

const createBody = z.object({
	name: z
		.string()
		.min(1)
		.max(64)
		.regex(/^[a-z][a-zA-Z0-9]*$/, "camelCase"),
	kind: z.enum(["QUERY", "COMMAND", "WORKFLOW"]),
	inputSchema: z.record(z.unknown()),
	outputSchema: z.record(z.unknown()).optional(),
	reads: z.array(z.string()).optional(),
	writes: z.array(z.string()).optional(),
	steps: operationStepsSchema,
	bodyHint: z.string().max(2000).optional(),
});

const updateBody = createBody.partial();

export const operationsRoutes = new Hono()
	.get("/", async (c) => {
		const projectId = c.req.param("id" as never) as string;
		const items = await prisma.operation.findMany({
			where: { projectId },
			orderBy: { name: "asc" },
		});
		return c.json({ items });
	})
	.get("/:oid", async (c) => {
		const { id: projectId, oid } = c.req.param() as Record<string, string>;
		const item = await prisma.operation.findFirst({
			where: { id: oid, projectId },
		});
		if (!item) return c.json({ error: "not_found" }, 404);
		return c.json({ item });
	})
	.post("/", zValidator("json", createBody, validationHook), async (c) => {
		const projectId = c.req.param("id" as never) as string;
		const data = c.req.valid("json");
		const item = await prisma.operation.create({
			data: {
				projectId,
				name: data.name,
				kind: data.kind,
				inputSchema: asJson(data.inputSchema),
				outputSchema: data.outputSchema ? asJson(data.outputSchema) : undefined,
				reads: data.reads ? asJson(data.reads) : undefined,
				writes: data.writes ? asJson(data.writes) : undefined,
				steps: asJson(data.steps),
				bodyHint: data.bodyHint,
			},
		});
		return c.json({ item }, 201);
	})
	.put("/:oid", zValidator("json", updateBody, validationHook), async (c) => {
		const { id: projectId, oid } = c.req.param() as Record<string, string>;
		const data = c.req.valid("json");
		const item = await prisma.operation.update({
			where: { id: oid, projectId },
			data: {
				...(data.name !== undefined && { name: data.name }),
				...(data.kind !== undefined && { kind: data.kind }),
				...(data.inputSchema !== undefined && { inputSchema: asJson(data.inputSchema) }),
				...(data.outputSchema !== undefined && { outputSchema: asJson(data.outputSchema) }),
				...(data.reads !== undefined && { reads: asJson(data.reads) }),
				...(data.writes !== undefined && { writes: asJson(data.writes) }),
				...(data.steps !== undefined && { steps: asJson(data.steps) }),
				...(data.bodyHint !== undefined && { bodyHint: data.bodyHint }),
			},
		});
		return c.json({ item });
	})
	.delete("/:oid", async (c) => {
		const { id: projectId, oid } = c.req.param() as Record<string, string>;
		await prisma.operation.delete({ where: { id: oid, projectId } });
		return c.json({ ok: true });
	});
