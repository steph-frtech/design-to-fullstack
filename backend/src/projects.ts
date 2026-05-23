import { Hono } from "hono";
import { prisma } from "./db";

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
