import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../db";
import { asJson } from "../lib/prisma-json";
import {
	type ScreenSpecCheck,
	isComplete,
	validateScreenSpec,
} from "../lib/screen-spec-validation";
import { validationHook } from "../lib/validation-hook";

const createBody = z.object({
	productSpecId: z.string().optional(),
	name: z.string().min(1).max(256),
	description: z.string().min(1).max(10_000),
	actor: z.string().max(256).optional(),
	purpose: z.string().max(2_000).optional(),
	userIntent: z.string().max(2_000).optional(),
	layoutHint: z.string().max(512).optional(),
	components: z.array(z.unknown()).optional(),
	fields: z.array(z.unknown()).optional(),
	actions: z.array(z.unknown()).optional(),
	dataNeeds: z.array(z.unknown()).optional(),
	businessRules: z.array(z.unknown()).optional(),
	emptyStates: z.array(z.unknown()).optional(),
	errorStates: z.array(z.unknown()).optional(),
	assumptions: z.array(z.unknown()).optional(),
	openQuestions: z.array(z.unknown()).optional(),
});

const updateBody = createBody.partial();

const JSON_KEYS = [
	"components",
	"fields",
	"actions",
	"dataNeeds",
	"businessRules",
	"emptyStates",
	"errorStates",
	"assumptions",
	"openQuestions",
] as const;

export const screenSpecsRoutes = new Hono()
	.get("/", async (c) => {
		const projectId = c.req.param("id" as never) as string;
		const items = await prisma.screenSpec.findMany({
			where: { projectId },
			orderBy: { updatedAt: "desc" },
		});
		return c.json({ items });
	})
	.get("/:ssid", async (c) => {
		const { id: projectId, ssid } = c.req.param() as Record<string, string>;
		const item = await prisma.screenSpec.findFirst({
			where: { id: ssid, projectId },
		});
		if (!item) return c.json({ error: "not_found" }, 404);
		return c.json({ item });
	})
	.post("/", zValidator("json", createBody, validationHook), async (c) => {
		const projectId = c.req.param("id" as never) as string;
		const data = c.req.valid("json");
		const createData: Record<string, unknown> = {
			projectId,
			name: data.name,
			description: data.description,
			productSpecId: data.productSpecId,
			actor: data.actor,
			purpose: data.purpose,
			userIntent: data.userIntent,
			layoutHint: data.layoutHint,
		};
		for (const k of JSON_KEYS) {
			const v = (data as Record<string, unknown>)[k];
			if (v !== undefined) createData[k] = asJson(v);
		}
		const item = await prisma.screenSpec.create({
			data: createData as never,
		});
		return c.json({ item }, 201);
	})
	.put("/:ssid", zValidator("json", updateBody, validationHook), async (c) => {
		const { id: projectId, ssid } = c.req.param() as Record<string, string>;
		const data = c.req.valid("json");
		const updateData: Record<string, unknown> = {};
		const scalarKeys = [
			"name",
			"description",
			"productSpecId",
			"actor",
			"purpose",
			"userIntent",
			"layoutHint",
		] as const;
		for (const k of scalarKeys) {
			const v = (data as Record<string, unknown>)[k];
			if (v !== undefined) updateData[k] = v;
		}
		for (const k of JSON_KEYS) {
			const v = (data as Record<string, unknown>)[k];
			if (v !== undefined) updateData[k] = asJson(v);
		}
		const item = await prisma.screenSpec.update({
			where: { id: ssid, projectId },
			data: updateData as never,
		});
		return c.json({ item });
	})
	.delete("/:ssid", async (c) => {
		const { id: projectId, ssid } = c.req.param() as Record<string, string>;
		await prisma.screenSpec.delete({ where: { id: ssid, projectId } });
		return c.json({ ok: true });
	})
	.post("/:ssid/validate", async (c) => {
		const { id: projectId, ssid } = c.req.param() as Record<string, string>;
		const item = await prisma.screenSpec.findFirst({
			where: { id: ssid, projectId },
		});
		if (!item) return c.json({ error: "not_found" }, 404);
		const checks: ScreenSpecCheck[] = validateScreenSpec(
			item as unknown as Record<string, unknown>,
		);
		return c.json({ checks, complete: isComplete(checks) });
	});
