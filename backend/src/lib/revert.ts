// Revert engine — turns a Revision (or a ChangeSet) into the inverse
// mutation, applied via the same Prisma client so that the revert itself
// emits Revisions (linked to the new "revert ChangeSet").

// We type the client as `any` because the extended Prisma client and the
// raw PrismaClient differ structurally; the revert engine only uses dynamic
// model access (lowercase first letter) and revision.create.
// biome-ignore lint/suspicious/noExplicitAny: see comment above
type PrismaClient = any;

type AnyRow = Record<string, unknown> & { id?: string; currentVersion?: number };

function delegateOf(client: PrismaClient, model: string) {
	const key = model.charAt(0).toLowerCase() + model.slice(1);
	const delegate = (
		client as unknown as Record<
			string,
			{
				findUnique: (a: unknown) => Promise<AnyRow | null>;
				create: (a: unknown) => Promise<AnyRow>;
				update: (a: unknown) => Promise<AnyRow>;
				delete: (a: unknown) => Promise<AnyRow>;
			} | undefined
		>
	)[key];
	if (!delegate) throw new Error(`No delegate for model ${model}`);
	return delegate;
}

export type RevertEntry = {
	revisionId: string;
	entityType: string;
	entityId: string;
	op: "CREATE" | "UPDATE" | "DELETE" | "RESTORE";
	status: "applied" | "skipped";
	reason?: string;
};

/// Revert ONE Revision. Returns a RevertEntry indicating what happened.
/// All mutations go through the client and therefore produce their own
/// Revisions (which will be linked to the active ChangeSet in context).
export async function revertOne(
	client: PrismaClient,
	rev: {
		id: string;
		entityType: string;
		entityId: string;
		op: "CREATE" | "UPDATE" | "DELETE" | "RESTORE";
		data: unknown;
		diff: unknown;
	},
): Promise<RevertEntry> {
	const delegate = delegateOf(client, rev.entityType);

	if (rev.op === "CREATE") {
		try {
			await delegate.delete({ where: { id: rev.entityId } });
			return {
				revisionId: rev.id,
				entityType: rev.entityType,
				entityId: rev.entityId,
				op: rev.op,
				status: "applied",
			};
		} catch (err) {
			return {
				revisionId: rev.id,
				entityType: rev.entityType,
				entityId: rev.entityId,
				op: rev.op,
				status: "skipped",
				reason: `target not found: ${(err as Error).message}`,
			};
		}
	}

	if (rev.op === "DELETE") {
		const snap = rev.data as Record<string, unknown>;
		try {
			await delegate.create({ data: stripAutoFields(snap) });
			return {
				revisionId: rev.id,
				entityType: rev.entityType,
				entityId: rev.entityId,
				op: rev.op,
				status: "applied",
			};
		} catch (err) {
			return {
				revisionId: rev.id,
				entityType: rev.entityType,
				entityId: rev.entityId,
				op: rev.op,
				status: "skipped",
				reason: `recreate failed: ${(err as Error).message}`,
			};
		}
	}

	if (rev.op === "UPDATE") {
		// diff is { field: [before, after] }. Revert sets back to `before`.
		const diff = rev.diff as Record<string, [unknown, unknown]> | null;
		if (!diff) {
			return {
				revisionId: rev.id,
				entityType: rev.entityType,
				entityId: rev.entityId,
				op: rev.op,
				status: "skipped",
				reason: "no diff to revert",
			};
		}
		const data: Record<string, unknown> = {};
		for (const [field, pair] of Object.entries(diff)) {
			if (isAutoField(field)) continue;
			data[field] = pair[0];
		}
		try {
			await delegate.update({ where: { id: rev.entityId }, data });
			return {
				revisionId: rev.id,
				entityType: rev.entityType,
				entityId: rev.entityId,
				op: rev.op,
				status: "applied",
			};
		} catch (err) {
			return {
				revisionId: rev.id,
				entityType: rev.entityType,
				entityId: rev.entityId,
				op: rev.op,
				status: "skipped",
				reason: `update failed: ${(err as Error).message}`,
			};
		}
	}

	// RESTORE op — never produced by the versioning extension in V1.
	return {
		revisionId: rev.id,
		entityType: rev.entityType,
		entityId: rev.entityId,
		op: rev.op,
		status: "skipped",
		reason: "RESTORE not supported",
	};
}

/// Revert one specific field of one UPDATE Revision (ultra-fine).
export async function revertField(
	client: PrismaClient,
	rev: {
		id: string;
		entityType: string;
		entityId: string;
		op: "CREATE" | "UPDATE" | "DELETE" | "RESTORE";
		diff: unknown;
	},
	field: string,
): Promise<RevertEntry> {
	if (rev.op !== "UPDATE")
		return {
			revisionId: rev.id,
			entityType: rev.entityType,
			entityId: rev.entityId,
			op: rev.op,
			status: "skipped",
			reason: "field-revert only applies to UPDATE",
		};
	const diff = rev.diff as Record<string, [unknown, unknown]> | null;
	const pair = diff?.[field];
	if (!pair)
		return {
			revisionId: rev.id,
			entityType: rev.entityType,
			entityId: rev.entityId,
			op: rev.op,
			status: "skipped",
			reason: `field "${field}" not in diff`,
		};
	if (isAutoField(field))
		return {
			revisionId: rev.id,
			entityType: rev.entityType,
			entityId: rev.entityId,
			op: rev.op,
			status: "skipped",
			reason: `field "${field}" is auto-managed`,
		};
	const delegate = delegateOf(client, rev.entityType);
	try {
		await delegate.update({
			where: { id: rev.entityId },
			data: { [field]: pair[0] },
		});
		return {
			revisionId: rev.id,
			entityType: rev.entityType,
			entityId: rev.entityId,
			op: rev.op,
			status: "applied",
		};
	} catch (err) {
		return {
			revisionId: rev.id,
			entityType: rev.entityType,
			entityId: rev.entityId,
			op: rev.op,
			status: "skipped",
			reason: `update failed: ${(err as Error).message}`,
		};
	}
}

// ─── Bulk ChangeSet revert ───────────────────────────────────────────────────

export type RevertChangeSetResult = {
	revertChangeSetId: string;
	entries: RevertEntry[];
};

/// Revert ALL Revisions of a ChangeSet in reverse order (version DESC).
/// Creates a new ChangeSet with revertOfId = originalChangeSetId and marks
/// the original as REVERTED.
///
/// The caller must pass the raw PrismaClient (with versioning extension) so
/// that the inverse mutations produce their own Revisions linked to the new CS.
export async function revertChangeSet(
	client: PrismaClient,
	changeSetId: string,
	opts?: { actorId?: string },
): Promise<RevertChangeSetResult> {
	const original = await (client as unknown as {
		changeSet: {
			findUnique: (a: unknown) => Promise<{
				id: string;
				projectId: string;
				message: string;
				status: string;
				revisions: {
					id: string;
					entityType: string;
					entityId: string;
					op: "CREATE" | "UPDATE" | "DELETE" | "RESTORE";
					data: unknown;
					diff: unknown;
					version: number;
				}[];
			} | null>;
			create: (a: unknown) => Promise<{ id: string }>;
			update: (a: unknown) => Promise<unknown>;
		};
	}).changeSet.findUnique({
		where: { id: changeSetId },
		include: { revisions: { orderBy: { version: "desc" } } },
	});
	if (!original) throw new Error(`ChangeSet ${changeSetId} not found`);

	const newCs = await (client as unknown as {
		changeSet: {
			create: (a: unknown) => Promise<{ id: string }>;
			update: (a: unknown) => Promise<unknown>;
		};
	}).changeSet.create({
		data: {
			projectId: original.projectId,
			message: `revert: ${original.message}`,
			status: "APPLIED",
			appliedAt: new Date(),
			revertOfId: original.id,
			actorId: opts?.actorId ?? null,
		},
	});

	const { runInChangeSet } = await import("./changeset-context");
	const entries: RevertEntry[] = [];
	await runInChangeSet(
		{
			changeSetId: newCs.id,
			projectId: original.projectId,
			origin: "explicit",
			actorId: opts?.actorId,
		},
		async () => {
			for (const rev of original.revisions) {
				entries.push(await revertOne(client, rev));
			}
		},
	);

	await (client as unknown as {
		changeSet: { update: (a: unknown) => Promise<unknown> };
	}).changeSet.update({
		where: { id: original.id },
		data: { status: "REVERTED", revertedAt: new Date(), revertedById: newCs.id },
	});

	return { revertChangeSetId: newCs.id, entries };
}

const AUTO_FIELDS = new Set([
	"id",
	"createdAt",
	"updatedAt",
	"currentVersion",
]);

function isAutoField(name: string): boolean {
	return AUTO_FIELDS.has(name);
}

function stripAutoFields<T extends Record<string, unknown>>(row: T): T {
	const out: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(row)) {
		if (k === "updatedAt") continue; // Prisma manages this
		out[k] = v;
	}
	return out as T;
}
