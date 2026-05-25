// Audit log emitter — best-effort, never crashes the caller.
//
// V1 strategy:
//   - Always appends a JSON line to a JSONL file on disk.
//   - Path: DTFS_AUDIT_LOG env var, default /tmp/dtfs-audit.jsonl.
//   - DB persist: ONLY if DTFS_AUDIT_DB=1 (flag indicating Phase 10 migration
//     has been applied and AuditLog.action/entityType/entityId/details columns exist).
//     Without that flag the DB write is skipped to avoid column-not-found errors.
//
// Never throws. File-write errors and DB errors are caught and logged to stderr.

import fs from "node:fs";
import { prisma } from "../../db";

export type AuditEvent = {
	projectId?: string;
	actor?: string;
	action: string;
	target?: unknown;
	metadata?: unknown;
};

type StoredEvent = AuditEvent & {
	id: string;
	createdAt: string;
};

function auditLogPath(): string {
	return process.env.DTFS_AUDIT_LOG ?? "/tmp/dtfs-audit.jsonl";
}

function randomId(): string {
	return `al_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function emitAuditEvent(event: AuditEvent): Promise<void> {
	const stored: StoredEvent = {
		...event,
		id: randomId(),
		createdAt: new Date().toISOString(),
	};

	// 1. JSONL append — always, best-effort
	try {
		fs.appendFileSync(auditLogPath(), JSON.stringify(stored) + "\n", "utf8");
	} catch (err) {
		console.error("[audit] failed to write JSONL:", err);
	}

	// 2. DB persist — only if DTFS_AUDIT_DB=1 (Phase 10 migration applied)
	if (process.env.DTFS_AUDIT_DB === "1") {
		try {
			await prisma.auditLog.create({
				data: {
					projectId: event.projectId ?? "unknown",
					actorId: null,
					kind: event.action,
					detail: (event.metadata ?? {}) as never,
					action: event.action,
					// entityType / entityId / details are Phase 10 columns
					// biome-ignore lint/suspicious/noExplicitAny: dynamic Phase 10 fields
					...(event.target && typeof event.target === "object"
						? {
								details: event.target as never,
							}
						: {}),
				},
			});
		} catch (err) {
			console.error("[audit] failed to persist to DB (is DTFS_AUDIT_DB migration applied?):", err);
		}
	}
}

export type AuditFilter = {
	projectId?: string;
	action?: string;
	limit?: number;
};

/**
 * Read back audit events from the JSONL file.
 * Returns events in reverse-chronological order (latest first).
 * Silently returns [] if the file doesn't exist.
 */
export function readAuditLog(filter?: AuditFilter): StoredEvent[] {
	const path = auditLogPath();
	let content: string;
	try {
		content = fs.readFileSync(path, "utf8");
	} catch {
		return [];
	}

	const lines = content.split("\n").filter((l) => l.trim().length > 0);
	const events: StoredEvent[] = [];

	for (const line of lines) {
		try {
			const ev = JSON.parse(line) as StoredEvent;
			if (filter?.projectId && ev.projectId !== filter.projectId) continue;
			if (filter?.action && ev.action !== filter.action) continue;
			events.push(ev);
		} catch {
			// malformed line — skip
		}
	}

	// Latest first
	events.reverse();

	if (filter?.limit != null && filter.limit > 0) {
		return events.slice(0, filter.limit);
	}

	return events;
}
