// Hono middleware that ensures every write to /api/projects/:id/* is wrapped
// in a ChangeSet. If the client sends X-ChangeSet-Id, we reuse it. Otherwise
// we open an implicit one-revision changeset whose message is auto-generated.

import type { MiddlewareHandler } from "hono";
import { prisma } from "../db";
import { runInChangeSet } from "./changeset-context";

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export const changeSetMiddleware: MiddlewareHandler = async (c, next) => {
	const method = c.req.method.toUpperCase();
	if (!WRITE_METHODS.has(method)) return next();

	const projectId = c.req.param("id");
	if (!projectId) return next();

	const explicit = c.req.header("X-ChangeSet-Id");
	if (explicit) {
		// Verify the changeset exists, is DRAFT, and belongs to this project.
		const cs = await prisma.changeSet.findFirst({
			where: { id: explicit, projectId, status: "DRAFT" },
		});
		if (!cs) {
			return c.json(
				{ error: "invalid_changeset", message: "X-ChangeSet-Id refers to a missing or non-DRAFT changeset" },
				400,
			);
		}
		return runInChangeSet(
			{ changeSetId: cs.id, projectId, origin: "explicit" },
			() => next(),
		);
	}

	// Implicit one-revision ChangeSet — auto-commits at the end.
	const csid = (
		await prisma.changeSet.create({
			data: {
				projectId,
				message: `auto: ${method} ${new URL(c.req.url).pathname}`,
				status: "DRAFT",
			},
		})
	).id;

	await runInChangeSet(
		{ changeSetId: csid, projectId, origin: "implicit" },
		() => next(),
	);

	// Auto-commit if 2xx AND the request actually emitted Revisions ; otherwise
	// drop the implicit ChangeSet so we don't pollute history with empty rows
	// (e.g. POST /validate, POST /sync, etc. — endpoints that don't mutate).
	const status = c.res.status;
	const revisionCount = await prisma.revision.count({
		where: { changeSetId: csid },
	});

	if (status >= 200 && status < 300 && revisionCount > 0) {
		await prisma.changeSet.update({
			where: { id: csid },
			data: { status: "APPLIED", appliedAt: new Date() },
		});
	} else {
		await prisma.revision.deleteMany({ where: { changeSetId: csid } });
		await prisma.changeSet.delete({ where: { id: csid } });
	}
};
