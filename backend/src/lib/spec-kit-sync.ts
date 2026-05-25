// Bidirectional disk ↔ DB sync for SDD artifacts following Spec Kit convention.
//
// Disk layout (relative to project.localPath):
//   .specify/memory/constitution.md
//   specs/<featureKey>/spec.md
//   specs/<featureKey>/plan.md
//   specs/<featureKey>/tasks.md
//   specs/<featureKey>/research.md
//   specs/<featureKey>/data-model.md
//   specs/<featureKey>/quickstart.md
//   specs/<featureKey>/platform-mapping.md
//
// V1 limitations:
// - `contracts/` directory is not synced (V1 has no contract content).
// - No merge: to-disk overwrites disk ; from-disk overwrites DB.
// - resolveSafe confines paths to PROJECTS_BASE_DIR.

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { prisma } from "../db";

const BASE_DIR = process.env.PROJECTS_BASE_DIR ?? "/data/dev";

function resolveSafe(localPath: string, relative: string): string | null {
	const abs = path.resolve(localPath, relative);
	const rel = path.relative(BASE_DIR, abs);
	if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
	return abs;
}

export function sha256(s: string): string {
	return createHash("sha256").update(s).digest("hex");
}

export function pathForKind(kind: string, featureKey?: string | null): string | null {
	if (kind === "constitution") return ".specify/memory/constitution.md";
	if (!featureKey) return null;
	if (kind === "spec") return `specs/${featureKey}/spec.md`;
	if (kind === "plan") return `specs/${featureKey}/plan.md`;
	if (kind === "tasks") return `specs/${featureKey}/tasks.md`;
	if (kind === "research") return `specs/${featureKey}/research.md`;
	if (kind === "data-model") return `specs/${featureKey}/data-model.md`;
	if (kind === "quickstart") return `specs/${featureKey}/quickstart.md`;
	if (kind === "platform-mapping")
		return `specs/${featureKey}/platform-mapping.md`;
	return null;
}

const KNOWN_KINDS = [
	"constitution",
	"spec",
	"plan",
	"tasks",
	"research",
	"data-model",
	"quickstart",
	"platform-mapping",
];

export type SyncEntry =
	| { kind: string; featureKey: string | null; path: string; action: "wrote" | "read" | "upserted" | "noop" | "skipped"; reason?: string };

export async function syncToDisk(opts: {
	projectId: string;
	featureKey?: string;
}): Promise<{ ok: boolean; entries: SyncEntry[]; reason?: string }> {
	const project = await prisma.project.findUnique({
		where: { id: opts.projectId },
	});
	if (!project)
		return { ok: false, entries: [], reason: "project_not_found" };
	if (!project.localPath)
		return { ok: false, entries: [], reason: "no_local_path" };

	const rows = await prisma.specArtifact.findMany({
		where: {
			projectId: opts.projectId,
			...(opts.featureKey ? { featureKey: opts.featureKey } : {}),
		},
	});
	const entries: SyncEntry[] = [];
	for (const row of rows) {
		const relPath = row.path ?? pathForKind(row.kind, row.featureKey ?? null);
		if (!relPath) {
			entries.push({
				kind: row.kind,
				featureKey: row.featureKey,
				path: "",
				action: "skipped",
				reason: "no path mapping",
			});
			continue;
		}
		const abs = resolveSafe(project.localPath, relPath);
		if (!abs) {
			entries.push({
				kind: row.kind,
				featureKey: row.featureKey,
				path: relPath,
				action: "skipped",
				reason: "path_outside_base",
			});
			continue;
		}
		await fs.mkdir(path.dirname(abs), { recursive: true });
		await fs.writeFile(abs, row.content, "utf8");
		// Persist the path used (for round-trip stability)
		if (row.path !== relPath) {
			await prisma.specArtifact.update({
				where: { id: row.id },
				data: { path: relPath },
			});
		}
		entries.push({
			kind: row.kind,
			featureKey: row.featureKey,
			path: relPath,
			action: "wrote",
		});
	}
	return { ok: true, entries };
}

export async function syncFromDisk(opts: {
	projectId: string;
	featureKey?: string;
}): Promise<{ ok: boolean; entries: SyncEntry[]; reason?: string }> {
	const project = await prisma.project.findUnique({
		where: { id: opts.projectId },
	});
	if (!project)
		return { ok: false, entries: [], reason: "project_not_found" };
	if (!project.localPath)
		return { ok: false, entries: [], reason: "no_local_path" };

	const entries: SyncEntry[] = [];
	const candidates: { kind: string; featureKey: string | null; relPath: string }[] = [];

	if (!opts.featureKey || opts.featureKey === "") {
		candidates.push({
			kind: "constitution",
			featureKey: null,
			relPath: pathForKind("constitution")!,
		});
	}

	const featureKeys = opts.featureKey ? [opts.featureKey] : await discoverFeatures(project.localPath);
	for (const fk of featureKeys) {
		for (const k of KNOWN_KINDS) {
			if (k === "constitution") continue;
			candidates.push({ kind: k, featureKey: fk, relPath: pathForKind(k, fk)! });
		}
	}

	for (const c of candidates) {
		const abs = resolveSafe(project.localPath, c.relPath);
		if (!abs) {
			entries.push({ ...c, path: c.relPath, action: "skipped", reason: "path_outside_base" });
			continue;
		}
		let content: string;
		try {
			content = await fs.readFile(abs, "utf8");
		} catch {
			continue; // file doesn't exist — skip silently
		}
		const hash = sha256(content);
		const existing = await prisma.specArtifact.findFirst({
			where: {
				projectId: opts.projectId,
				kind: c.kind,
				featureKey: c.featureKey,
			},
			orderBy: { updatedAt: "desc" },
		});
		if (existing && existing.contentHash === hash) {
			entries.push({ ...c, path: c.relPath, action: "noop" });
			continue;
		}
		if (existing) {
			await prisma.specArtifact.update({
				where: { id: existing.id },
				data: { content, contentHash: hash, source: "manual", path: c.relPath },
			});
		} else {
			await prisma.specArtifact.create({
				data: {
					projectId: opts.projectId,
					kind: c.kind,
					featureKey: c.featureKey,
					path: c.relPath,
					content,
					contentHash: hash,
					source: "manual",
				},
			});
		}
		entries.push({ ...c, path: c.relPath, action: "upserted" });
	}
	return { ok: true, entries };
}

async function discoverFeatures(localPath: string): Promise<string[]> {
	const dir = path.join(localPath, "specs");
	try {
		const entries = await fs.readdir(dir, { withFileTypes: true });
		return entries.filter((e) => e.isDirectory()).map((e) => e.name);
	} catch {
		return [];
	}
}
