import { zValidator } from "@hono/zod-validator";
import type { Context } from "hono";
import { Hono } from "hono";
import { z, type ZodError } from "zod";
import { prisma } from "./db";

const slugRe = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const localeCodeRe = /^[a-z]{2}(?:-[A-Z]{2})?$/;

// zValidator hook → returns a clean { error, issues } shape on validation
// failure so the frontend can render readable messages.
function validationHook<T>(
	result: { success: true; data: T } | { success: false; error: ZodError },
	c: Context,
) {
	if (!result.success) {
		return c.json(
			{
				error: "validation_failed",
				issues: result.error.issues.map((i) => ({
					path: i.path.join("."),
					message: i.message,
				})),
			},
			400,
		);
	}
}

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
				localeCode: z
					.string()
					.regex(localeCodeRe, 'use a code like "en" or "fr-FR"')
					.default("en"),
				localeName: z.string().min(1).max(64).default("English"),
				extraLocales: z
					.array(
						z.object({
							code: z
								.string()
								.regex(localeCodeRe, 'use a code like "en" or "fr-FR"'),
							name: z.string().min(1).max(64),
						}),
					)
					.default([]),
			}),
			validationHook,
		),
		async (c) => {
			const { slug, localeCode, localeName, extraLocales } =
				c.req.valid("json");

			const existing = await prisma.project.findUnique({ where: { slug } });
			if (existing) return c.json({ error: "slug_taken" }, 409);

			const defaultLocale = await prisma.locale.upsert({
				where: { code: localeCode },
				update: {},
				create: { code: localeCode, name: localeName, isDefault: true },
			});

			const extras = await Promise.all(
				extraLocales
					.filter((l) => l.code !== localeCode)
					.map((l) =>
						prisma.locale.upsert({
							where: { code: l.code },
							update: {},
							create: { code: l.code, name: l.name },
						}),
					),
			);

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
					defaultLocaleId: defaultLocale.id,
					locales: {
						create: [
							{ localeId: defaultLocale.id },
							...extras.map((l) => ({ localeId: l.id })),
						],
					},
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
	})

	.get("/:id/translations", async (c) => {
		const projectId = c.req.param("id");
		const localeCode = c.req.query("locale");
		const translations = await prisma.translation.findMany({
			where: {
				textKey: { projectId },
				...(localeCode ? { locale: { code: localeCode } } : {}),
			},
			include: { textKey: true, locale: true },
			orderBy: { textKey: { namespace: "asc" } },
		});
		return c.json({ translations });
	})

	// ─── Manage project locales ────────────────────────────────────────
	.post(
		"/:id/locales",
		zValidator(
			"json",
			z.object({
				localeCode: z
					.string()
					.regex(localeCodeRe, 'use a code like "en" or "fr-FR"'),
				localeName: z.string().min(1).max(64),
			}),
			validationHook,
		),
		async (c) => {
			const projectId = c.req.param("id") as string;
			const { localeCode, localeName } = c.req.valid("json");

			const project = await prisma.project.findUnique({
				where: { id: projectId },
			});
			if (!project) return c.json({ error: "project_not_found" }, 404);

			const locale = await prisma.locale.upsert({
				where: { code: localeCode },
				update: {},
				create: { code: localeCode, name: localeName },
			});

			await prisma.projectLocale.upsert({
				where: { projectId_localeId: { projectId, localeId: locale.id } },
				update: {},
				create: { projectId, localeId: locale.id },
			});

			return c.json({ locale }, 201);
		},
	)

	.delete("/:id/locales/:localeId", async (c) => {
		const { id: projectId, localeId } = c.req.param();

		const project = await prisma.project.findUnique({
			where: { id: projectId },
		});
		if (!project) return c.json({ error: "project_not_found" }, 404);
		if (project.defaultLocaleId === localeId) {
			return c.json({ error: "cannot_remove_default_locale" }, 400);
		}

		await prisma.projectLocale.delete({
			where: { projectId_localeId: { projectId, localeId } },
		});
		return c.json({ ok: true });
	})

	// ─── Upsert a translation value ────────────────────────────────────
	.put(
		"/:id/translations",
		zValidator(
			"json",
			z.object({
				namespace: z.string().min(1).max(256),
				localeCode: z
					.string()
					.regex(localeCodeRe, 'use a code like "en" or "fr-FR"'),
				value: z.string().max(10_000),
			}),
			validationHook,
		),
		async (c) => {
			const projectId = c.req.param("id") as string;
			const { namespace, localeCode, value } = c.req.valid("json");

			const locale = await prisma.locale.findUnique({
				where: { code: localeCode },
			});
			if (!locale) return c.json({ error: "locale_not_found" }, 404);

			// Ensure locale is linked to project
			await prisma.projectLocale.upsert({
				where: {
					projectId_localeId: { projectId, localeId: locale.id },
				},
				update: {},
				create: { projectId, localeId: locale.id },
			});

			const textKey = await prisma.textKey.upsert({
				where: {
					projectId_namespace: { projectId, namespace },
				},
				update: {},
				create: { projectId, namespace },
			});

			const translation = await prisma.translation.upsert({
				where: {
					textKeyId_localeId: { textKeyId: textKey.id, localeId: locale.id },
				},
				update: { value },
				create: { textKeyId: textKey.id, localeId: locale.id, value },
				include: { textKey: true, locale: true },
			});

			return c.json({ translation });
		},
	);

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

