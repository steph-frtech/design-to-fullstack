// codegen.ts — main entry point for the DTFS codegen pass.
// Contract-driven (Phase 28): spec → contracts → emitters → files.
// Legacy direct-from-spec path preserved for backward compatibility.
//
// SANDBOX: never writes outside /tmp or <projectLocalPath>/generated/.
// See safe-path.ts for the enforcement logic.

import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { prisma } from "../db";
import { resolveSafeOutDir, writeGenFile } from "./safe-path";
import { emitPrismaSchema } from "./emit-prisma";
import { emitHonoRoutes, emitHonoBackendApi } from "./emit-hono";
import { emitOperationHandlers } from "./emit-operations";
import { emitNextPages, emitNextFrontend } from "./emit-next";
import { emitSharedPackage } from "./emit-shared";
import { emitAuthRuntime } from "./emit-auth";
import { emitSdk } from "./emit-sdk";
import { emitTests } from "./emit-tests";
import { compileBackendContract } from "../lib/contracts/compile-backend";
import { compileFrontendContract } from "../lib/contracts/compile-frontend";
import { compileSharedContract } from "../lib/contracts/compile-shared";
import type {
	CodegenSpec,
	CodegenResult,
	GeneratedFile,
	ManifestEntry,
} from "./types";

export type { CodegenSpec, CodegenResult, GeneratedFile, ManifestEntry };

export type CodegenLayer =
	| "all"
	| "database"
	| "shared"
	| "auth"
	| "backend"
	| "frontend"
	| "sdk"
	| "tests";

export type CodegenOptions = {
	/** Target output directory. Default: /tmp/dtfs-codegen-<projectId> */
	outDir?: string;
	/**
	 * If true (default), do not write anything to disk — only compute
	 * the manifest and return it in memory.
	 */
	dryRun?: boolean;
	/**
	 * Which layer(s) to generate. Default: "all".
	 */
	layer?: CodegenLayer;
};

/** Stable SHA-256 hex digest of a UTF-8 string. */
export function contentHash(text: string): string {
	return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Load the project spec from the database.
 * Returns null if the project is not found.
 */
async function loadSpec(projectId: string): Promise<CodegenSpec | null> {
	const project = await prisma.project.findUnique({
		where: { id: projectId },
		select: {
			id: true,
			slug: true,
			localPath: true,
			entities: {
				select: {
					id: true,
					name: true,
					attributes: {
						select: {
							name: true,
							type: true,
							required: true,
							unique: true,
						},
						orderBy: { name: "asc" },
					},
				},
				orderBy: { name: "asc" },
			},
			entityRelations: {
				select: {
					id: true,
					fromEntityId: true,
					toEntityId: true,
					name: true,
					kind: true,
					required: true,
					fromField: true,
				},
			},
			resources: {
				select: {
					id: true,
					entityId: true,
					name: true,
					exposedOps: true,
				},
				orderBy: { name: "asc" },
			},
			operations: {
				select: {
					id: true,
					name: true,
					kind: true,
					inputSchema: true,
					outputSchema: true,
					steps: true,
					bodyHint: true,
				},
				orderBy: { name: "asc" },
			},
			screens: {
				select: {
					id: true,
					path: true,
					type: true,
					components: {
						select: {
							id: true,
							type: true,
							config: true,
						},
						orderBy: { order: "asc" },
					},
				},
				orderBy: { path: "asc" },
			},
		},
	});

	if (!project) return null;

	return {
		project: {
			id: project.id,
			slug: project.slug,
			localPath: project.localPath,
		},
		entities: project.entities.map((e) => ({
			id: e.id,
			name: e.name,
			attributes: e.attributes.map((a) => ({
				name: a.name,
				type: a.type as string,
				required: a.required,
				unique: a.unique,
			})),
		})),
		entityRelations: project.entityRelations.map((r) => ({
			id: r.id,
			fromEntityId: r.fromEntityId,
			toEntityId: r.toEntityId,
			name: r.name,
			kind: r.kind as string,
			required: r.required,
			fromField: r.fromField,
		})),
		resources: project.resources.map((r) => ({
			id: r.id,
			entityId: r.entityId,
			name: r.name,
			exposedOps: r.exposedOps,
		})),
		operations: project.operations.map((o) => ({
			id: o.id,
			name: o.name,
			kind: o.kind as string,
			inputSchema: o.inputSchema,
			outputSchema: o.outputSchema,
			steps: o.steps,
			bodyHint: o.bodyHint,
		})),
		screens: project.screens.map((s) => ({
			id: s.id,
			path: s.path,
			type: s.type,
			components: s.components.map((c) => ({
				id: c.id,
				type: c.type,
				config: c.config,
			})),
		})),
	};
}

// ─── Granular generate functions ──────────────────────────────────────────────

/**
 * Plan codegen: returns the order + what would be generated without writing.
 */
export async function planCodegen(projectId: string): Promise<{
	order: CodegenLayer[];
	layers: Record<CodegenLayer, { description: string; estimatedFiles: number }>;
}> {
	// Load spec for file count estimates
	const spec = await loadSpec(projectId);
	const entityCount = spec?.entities.length ?? 0;
	const screenCount = spec?.screens.length ?? 0;
	const operationCount = spec?.operations.length ?? 0;
	const resourceCount = spec?.resources.length ?? 0;

	const order: CodegenLayer[] = ["database", "shared", "auth", "backend", "frontend", "sdk", "tests"];

	const layers: Record<CodegenLayer, { description: string; estimatedFiles: number }> = {
		all: { description: "All layers", estimatedFiles: entityCount + screenCount + operationCount + resourceCount + 12 },
		database: { description: "Prisma schema (prisma/schema.prisma)", estimatedFiles: 1 },
		shared: { description: "packages/shared: types, schemas, errors, api-contract", estimatedFiles: 5 },
		auth: { description: "apps/api/src/auth.ts (Better Auth config stub)", estimatedFiles: 1 },
		backend: {
			description: "apps/api/src: index.ts, routes/, operations/, middleware/, repositories/",
			estimatedFiles: resourceCount + operationCount + entityCount + 3,
		},
		frontend: {
			description: "apps/web: app/, components/generated/, lib/",
			estimatedFiles: screenCount + 5,
		},
		sdk: { description: "packages/shared/src/sdk: typed client", estimatedFiles: 2 },
		tests: { description: "tests/: api/, e2e/, contract/ stubs", estimatedFiles: resourceCount + 2 },
	};

	return { order, layers };
}

/**
 * Generate only the database schema layer.
 */
export async function generateDatabaseSchema(
	projectId: string,
	opts: CodegenOptions = {},
): Promise<CodegenResult> {
	const dryRun = opts.dryRun !== false;
	const spec = await loadSpec(projectId);
	if (!spec) throw new Error(`Project not found: ${projectId}`);

	const rawOutDir = opts.outDir ?? `/tmp/dtfs-codegen-${projectId}`;
	const outDir = resolveSafeOutDir(rawOutDir, spec.project.localPath ?? undefined);

	const files: GeneratedFile[] = [
		{
			path: "prisma/schema.prisma",
			kind: "CODE",
			content: emitPrismaSchema(spec),
		},
	];

	return writeAndReturn(projectId, outDir, files, dryRun, "database");
}

/**
 * Generate only the shared SDK layer.
 */
export async function generateSharedSdk(
	projectId: string,
	opts: CodegenOptions = {},
): Promise<CodegenResult> {
	const dryRun = opts.dryRun !== false;
	const spec = await loadSpec(projectId);
	if (!spec) throw new Error(`Project not found: ${projectId}`);

	const rawOutDir = opts.outDir ?? `/tmp/dtfs-codegen-${projectId}`;
	const outDir = resolveSafeOutDir(rawOutDir, spec.project.localPath ?? undefined);

	const sharedContract = await compileSharedContract(projectId);
	const files: GeneratedFile[] = [
		...emitSharedPackage(sharedContract),
		...emitSdk(sharedContract),
	];

	return writeAndReturn(projectId, outDir, files, dryRun, "shared+sdk");
}

/**
 * Generate only the auth runtime layer.
 */
export async function generateAuthRuntime(
	projectId: string,
	opts: CodegenOptions = {},
): Promise<CodegenResult> {
	const dryRun = opts.dryRun !== false;
	const spec = await loadSpec(projectId);
	if (!spec) throw new Error(`Project not found: ${projectId}`);

	const rawOutDir = opts.outDir ?? `/tmp/dtfs-codegen-${projectId}`;
	const outDir = resolveSafeOutDir(rawOutDir, spec.project.localPath ?? undefined);

	const backendContract = await compileBackendContract(projectId);
	const files: GeneratedFile[] = emitAuthRuntime(backendContract);

	return writeAndReturn(projectId, outDir, files, dryRun, "auth");
}

/**
 * Generate only the backend API layer.
 */
export async function generateBackendApi(
	projectId: string,
	opts: CodegenOptions = {},
): Promise<CodegenResult> {
	const dryRun = opts.dryRun !== false;
	const spec = await loadSpec(projectId);
	if (!spec) throw new Error(`Project not found: ${projectId}`);

	const rawOutDir = opts.outDir ?? `/tmp/dtfs-codegen-${projectId}`;
	const outDir = resolveSafeOutDir(rawOutDir, spec.project.localPath ?? undefined);

	const backendContract = await compileBackendContract(projectId);
	const files: GeneratedFile[] = emitHonoBackendApi(backendContract);

	return writeAndReturn(projectId, outDir, files, dryRun, "backend");
}

/**
 * Generate only the frontend Next.js layer.
 */
export async function generateFrontendNext(
	projectId: string,
	opts: CodegenOptions = {},
): Promise<CodegenResult> {
	const dryRun = opts.dryRun !== false;
	const spec = await loadSpec(projectId);
	if (!spec) throw new Error(`Project not found: ${projectId}`);

	const rawOutDir = opts.outDir ?? `/tmp/dtfs-codegen-${projectId}`;
	const outDir = resolveSafeOutDir(rawOutDir, spec.project.localPath ?? undefined);

	const frontendContract = await compileFrontendContract(projectId);
	const files: GeneratedFile[] = emitNextFrontend(frontendContract);

	return writeAndReturn(projectId, outDir, files, dryRun, "frontend");
}

/**
 * Generate only the tests layer.
 */
export async function generateTests(
	projectId: string,
	opts: CodegenOptions = {},
): Promise<CodegenResult> {
	const dryRun = opts.dryRun !== false;
	const spec = await loadSpec(projectId);
	if (!spec) throw new Error(`Project not found: ${projectId}`);

	const rawOutDir = opts.outDir ?? `/tmp/dtfs-codegen-${projectId}`;
	const outDir = resolveSafeOutDir(rawOutDir, spec.project.localPath ?? undefined);

	const [backendContract, sharedContract] = await Promise.all([
		compileBackendContract(projectId),
		compileSharedContract(projectId),
	]);
	const files: GeneratedFile[] = emitTests(backendContract, sharedContract);

	return writeAndReturn(projectId, outDir, files, dryRun, "tests");
}

// ─── Verify tools ─────────────────────────────────────────────────────────────

const EXPECTED_DIRS = ["apps/api", "apps/web", "packages/shared"];

export type CheckResult = {
	ok: boolean;
	issues: string[];
	checkedDirs: string[];
};

/**
 * Check that the generated project has the expected structure.
 * Reads .dtfs-manifest.json if present to detect protected file overwrite risks.
 */
export function checkGeneratedProject(outDir: string): CheckResult {
	const issues: string[] = [];
	const checkedDirs: string[] = [];

	for (const dir of EXPECTED_DIRS) {
		const fullPath = path.join(outDir, dir);
		checkedDirs.push(fullPath);
		if (!fs.existsSync(fullPath)) {
			issues.push(`Missing expected directory: ${dir}`);
		}
	}

	// Check manifest
	const manifestPath = path.join(outDir, ".dtfs-manifest.json");
	if (fs.existsSync(manifestPath)) {
		try {
			const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
				files?: Array<{ path: string; protected?: boolean }>;
			};
			const protected_ = (manifest.files ?? []).filter((f) => f.protected);
			if (protected_.length > 0) {
				issues.push(`${protected_.length} protected file(s) detected — regeneration may overwrite them`);
			}
		} catch {
			issues.push("Could not parse .dtfs-manifest.json");
		}
	}

	return {
		ok: issues.length === 0,
		issues,
		checkedDirs,
	};
}

export type TypecheckResult =
	| { skipped: true; reason: string }
	| { skipped: false; ok: boolean; output: string; exitCode: number };

/**
 * Attempt to run tsc --noEmit in outDir if a tsconfig.json is present.
 * Best-effort with a 15s timeout.
 */
export async function typecheckGeneratedProject(outDir: string): Promise<TypecheckResult> {
	const tsconfigPath = path.join(outDir, "tsconfig.json");
	if (!fs.existsSync(tsconfigPath)) {
		return { skipped: true, reason: "No tsconfig.json found in outDir" };
	}

	try {
		const { execFileSync } = await import("node:child_process");
		const result = execFileSync("npx", ["tsc", "--noEmit", "--project", tsconfigPath], {
			cwd: outDir,
			timeout: 15_000,
			encoding: "utf8",
		});
		return { skipped: false, ok: true, output: result, exitCode: 0 };
	} catch (err) {
		const e = err as { message?: string; status?: number; stdout?: string; stderr?: string };
		return {
			skipped: false,
			ok: false,
			output: e.stdout ?? e.message ?? String(err),
			exitCode: e.status ?? 1,
		};
	}
}

export type RunTestsResult = { skipped: true; reason: string };

/**
 * V1 stub — generated tests are stubs, not runnable.
 */
export function runGeneratedTests(_outDir: string): RunTestsResult {
	return { skipped: true, reason: "generated tests are stubs (V1)" };
}

export type DiffResult = {
	added: string[];
	removed: string[];
	changed: string[];
};

type Manifest = { files?: Array<{ path: string; contentHash?: string }> };

function loadManifest(outDir: string): Manifest {
	const p = path.join(outDir, ".dtfs-manifest.json");
	if (!fs.existsSync(p)) return { files: [] };
	try {
		return JSON.parse(fs.readFileSync(p, "utf8")) as Manifest;
	} catch {
		return { files: [] };
	}
}

/**
 * Diff two manifest files by contentHash.
 */
export function diffGeneratedArtifacts(
	_projectId: string,
	outDirA: string,
	outDirB: string,
): DiffResult {
	const manifestA = loadManifest(outDirA);
	const manifestB = loadManifest(outDirB);

	const mapA = new Map((manifestA.files ?? []).map((f) => [f.path, f.contentHash ?? ""]));
	const mapB = new Map((manifestB.files ?? []).map((f) => [f.path, f.contentHash ?? ""]));

	const added: string[] = [];
	const removed: string[] = [];
	const changed: string[] = [];

	for (const [p, hashB] of mapB) {
		if (!mapA.has(p)) {
			added.push(p);
		} else if (mapA.get(p) !== hashB) {
			changed.push(p);
		}
	}

	for (const p of mapA.keys()) {
		if (!mapB.has(p)) {
			removed.push(p);
		}
	}

	return { added, removed, changed };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function buildManifestEntries(files: GeneratedFile[]): ManifestEntry[] {
	return files.map((f) => ({
		path: f.path,
		kind: f.kind,
		contentHash: contentHash(f.content),
		bytes: Buffer.byteLength(f.content, "utf8"),
		protected: false,
	}));
}

function writeAndReturn(
	projectId: string,
	outDir: string,
	files: GeneratedFile[],
	dryRun: boolean,
	layerLabel: string,
): CodegenResult {
	const manifestEntries = buildManifestEntries(files);

	if (!dryRun) {
		for (const file of files) {
			writeGenFile(outDir, file.path, file.content);
		}
		const manifest = {
			projectId,
			generatedAt: new Date().toISOString(),
			outDir,
			layer: layerLabel,
			files: manifestEntries,
		};
		writeGenFile(outDir, ".dtfs-manifest.json", JSON.stringify(manifest, null, 2));
	}

	// Build per-layer counts
	const prismaFiles = files.filter((f) => f.path.endsWith("schema.prisma"));
	const honoFiles = files.filter((f) => f.path.startsWith("apps/api/src/routes/") || f.path === "apps/api/src/index.ts");
	const opFiles = files.filter((f) => f.path.includes("/operations/"));
	const nextFiles = files.filter((f) => f.path.startsWith("apps/web/"));
	const sharedFiles = files.filter((f) => f.path.startsWith("packages/shared/"));
	const testFiles = files.filter((f) => f.path.startsWith("tests/"));

	return {
		outDir,
		files: manifestEntries,
		counts: {
			total: files.length,
			prismaSchema: prismaFiles.length,
			honoRoutes: honoFiles.length,
			operationHandlers: opFiles.length,
			nextPages: nextFiles.length,
			sharedFiles: sharedFiles.length,
			testFiles: testFiles.length,
		},
	};
}

// ─── Main generateApp (contract-driven, default path) ─────────────────────────

/**
 * Run the full contract-driven codegen pass for a project.
 *
 * Order: database → shared → auth → backend → frontend → sdk → tests
 *
 * dryRun (default: true) — no files are written to disk.
 * layer — restrict to a single layer; "all" generates everything.
 * When dryRun=false, files are written to outDir and .dtfs-manifest.json is persisted.
 */
export async function generateApp(
	projectId: string,
	opts: CodegenOptions = {},
): Promise<CodegenResult> {
	const dryRun = opts.dryRun !== false; // default true
	const layer = opts.layer ?? "all";

	const spec = await loadSpec(projectId);
	if (!spec) {
		throw new Error(`Project not found: ${projectId}`);
	}

	const defaultOutDir = `/tmp/dtfs-codegen-${projectId}`;
	const rawOutDir = opts.outDir ?? defaultOutDir;
	const outDir = resolveSafeOutDir(rawOutDir, spec.project.localPath ?? undefined);

	// ─── Compile contracts (Phase 26) ─────────────────────────────────────────
	const [backendContract, frontendContract, sharedContract] = await Promise.all([
		compileBackendContract(projectId),
		compileFrontendContract(projectId),
		compileSharedContract(projectId),
	]);

	// ─── Collect files in order: database → shared → auth → backend → frontend → sdk → tests ──

	const allFiles: GeneratedFile[] = [];

	// 1. Database schema (from spec — entity model, not contract-driven)
	if (layer === "all" || layer === "database") {
		allFiles.push({
			path: "prisma/schema.prisma",
			kind: "CODE",
			content: emitPrismaSchema(spec),
		});
	}

	// 2. Shared schemas/types (from SharedContract)
	if (layer === "all" || layer === "shared") {
		allFiles.push(...emitSharedPackage(sharedContract));
	}

	// 3. Auth runtime (from BackendContract.auth)
	if (layer === "all" || layer === "auth") {
		allFiles.push(...emitAuthRuntime(backendContract));
	}

	// 4. Backend Hono API (from BackendContract)
	if (layer === "all" || layer === "backend") {
		allFiles.push(...emitHonoBackendApi(backendContract));
	}

	// 5. Frontend Next.js (from FrontendContract)
	if (layer === "all" || layer === "frontend") {
		allFiles.push(...emitNextFrontend(frontendContract));
	}

	// 6. SDK (from SharedContract)
	if (layer === "all" || layer === "sdk") {
		allFiles.push(...emitSdk(sharedContract));
	}

	// 7. Tests
	if (layer === "all" || layer === "tests") {
		allFiles.push(...emitTests(backendContract, sharedContract));
	}

	return writeAndReturn(projectId, outDir, allFiles, dryRun, layer);
}

// ─── Legacy emitters (kept for backward compat / dtfs__preview_generated_file) ─

/**
 * @deprecated Use generateApp (contract-driven). Kept for backward compatibility.
 */
export function generateLegacyFiles(spec: CodegenSpec): GeneratedFile[] {
	return [
		{
			path: "backend/prisma/schema.prisma",
			kind: "CODE",
			content: emitPrismaSchema(spec),
		},
		...emitHonoRoutes(spec),
		...emitOperationHandlers(spec),
		...emitNextPages(spec),
	];
}
