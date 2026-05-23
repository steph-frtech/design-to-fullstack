import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "./db";

const slugRe = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

export const projectsRoutes = new Hono()
	.get("/", async (c) => {
		const projects = await prisma.project.findMany({
			orderBy: { updatedAt: "desc" },
			include: {
				defaultLocale: true,
				_count: { select: { screens: true, entities: true } },
			},
		});
		return c.json({ projects });
	})

	.post(
		"/",
		zValidator(
			"json",
			z.object({
				slug: z
					.string()
					.min(2)
					.max(64)
					.regex(slugRe, "lowercase letters, digits, hyphens"),
				localeCode: z.string().min(2).max(10).default("en"),
				localeName: z.string().min(1).max(64).default("English"),
			}),
		),
		async (c) => {
			const { slug, localeCode, localeName } = c.req.valid("json");

			const existing = await prisma.project.findUnique({ where: { slug } });
			if (existing) return c.json({ error: "slug_taken" }, 409);

			const locale = await prisma.locale.upsert({
				where: { code: localeCode },
				update: {},
				create: { code: localeCode, name: localeName, isDefault: true },
			});

			// TEMP owner — replace once auth is wired in the UI.
			const owner = await prisma.user.upsert({
				where: { email: "demo@design-to-fullstack.local" },
				update: {},
				create: {
					id: "demo-user",
					email: "demo@design-to-fullstack.local",
					name: "Demo User",
				},
			});

			const project = await prisma.project.create({
				data: {
					slug,
					ownerId: owner.id,
					defaultLocaleId: locale.id,
					locales: { create: [{ localeId: locale.id }] },
				},
				include: { defaultLocale: true },
			});

			return c.json({ project }, 201);
		},
	)

	.get("/:id", async (c) => {
		const id = c.req.param("id");
		const project = await prisma.project.findUnique({
			where: { id },
			include: {
				defaultLocale: true,
				locales: { include: { locale: true } },
				theme: true,
				entities: {
					include: { _count: { select: { attributes: true, records: true } } },
				},
				screens: {
					orderBy: { order: "asc" },
					include: { _count: { select: { components: true } } },
				},
			},
		});
		if (!project) return c.json({ error: "not_found" }, 404);
		return c.json({ project });
	})

	.get("/:id/screens/:screenId", async (c) => {
		const { id, screenId } = c.req.param();
		const screen = await prisma.screen.findFirst({
			where: { id: screenId, projectId: id },
			include: {
				components: {
					orderBy: { order: "asc" },
					include: {
						children: { orderBy: { order: "asc" } },
						form: {
							include: {
								fields: {
									orderBy: { order: "asc" },
									include: { options: { orderBy: { order: "asc" } } },
								},
							},
						},
					},
				},
			},
		});
		if (!screen) return c.json({ error: "not_found" }, 404);
		return c.json({ screen });
	});

export const revisionsRoutes = new Hono().get("/", async (c) => {
	const entityType = c.req.query("entityType");
	const entityId = c.req.query("entityId");
	if (!entityType || !entityId) {
		return c.json({ error: "entityType and entityId are required" }, 400);
	}
	const revisions = await prisma.revision.findMany({
		where: { entityType, entityId },
		orderBy: { version: "desc" },
		include: { actor: { select: { id: true, name: true, email: true } } },
	});
	return c.json({ revisions });
});

export const translationsRoutes = new Hono().get("/", async (c) => {
	const localeCode = c.req.query("locale");
	const translations = await prisma.translation.findMany({
		where: localeCode ? { locale: { code: localeCode } } : undefined,
		include: { textKey: true, locale: true },
		orderBy: { textKey: { namespace: "asc" } },
	});
	return c.json({ translations });
});
