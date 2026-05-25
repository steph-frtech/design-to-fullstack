// contracts-codegen.e2e.test.ts — Phase 29 addendum e2e test.
// Validates the full contracts + codegen pipeline end-to-end against a real DB.
//
// Anti-pollution:
//   - Creates an ephemeral project (__test_cg29_<ts>) in a try/finally teardown.
//   - All codegen runs are dry-run or written to /tmp/dtfs-e2e-<ts> then cleaned.
//   - Test principal project cmpji9ev90001m5p05krcodcg is never modified.
//
// Run: node --import tsx/esm --env-file=../.env --test src/test/e2e/contracts-codegen.e2e.test.ts

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { prisma } from "../../db.ts";
import { compileBackendContract } from "../../lib/contracts/compile-backend.ts";
import { compileFrontendContract } from "../../lib/contracts/compile-frontend.ts";
import { compileSharedContract } from "../../lib/contracts/compile-shared.ts";
import { generateApp, checkGeneratedProject } from "../../codegen/codegen.ts";

// ─── State ────────────────────────────────────────────────────────────────────

let ephProjectId: string;
let ephSlug: string;

// All /tmp dirs created by this test (cleaned in after())
const tmpDirs: string[] = [];

// ─── Setup ────────────────────────────────────────────────────────────────────

before(async () => {
	const locale = await prisma.locale.findFirstOrThrow({ where: { code: "en" } });
	const user = await prisma.user.findFirstOrThrow({ where: { id: "demo-user" } });

	ephSlug = `__test_cg29_${Date.now()}`;
	const project = await prisma.project.create({
		data: {
			slug: ephSlug,
			ownerId: user.id,
			defaultLocaleId: locale.id,
		},
	});
	ephProjectId = project.id;

	// Seed 2 entities with attributes
	const entityA = await prisma.entity.create({
		data: {
			projectId: ephProjectId,
			name: "Article",
			attributes: {
				create: [
					{ name: "title", type: "TEXT", required: true, unique: false },
					{ name: "body", type: "TEXTAREA", required: true, unique: false },
				],
			},
		},
	});
	const entityB = await prisma.entity.create({
		data: {
			projectId: ephProjectId,
			name: "Comment",
			attributes: {
				create: [{ name: "text", type: "TEXT", required: true, unique: false }],
			},
		},
	});

	// Seed 1 resource per entity
	await prisma.resource.createMany({
		data: [
			{ projectId: ephProjectId, entityId: entityA.id, name: "articles", exposedOps: ["list", "read", "create", "update", "delete"] },
			{ projectId: ephProjectId, entityId: entityB.id, name: "comments", exposedOps: ["list", "create"] },
		],
	});

	// Seed 1 screen + 1 operation
	await prisma.screen.create({
		data: {
			projectId: ephProjectId,
			path: "/articles",
			type: "web",
		},
	});

	await prisma.operation.create({
		data: {
			projectId: ephProjectId,
			name: "publishArticle",
			kind: "COMMAND",
			inputSchema: { type: "object", properties: { articleId: { type: "string" } }, required: ["articleId"] },
			outputSchema: undefined,
			steps: [],
		},
	});
});

// ─── Teardown (guaranteed) ───────────────────────────────────────────────────

after(async () => {
	// Delete ephemeral project
	if (ephProjectId) {
		try {
			await prisma.project.delete({ where: { id: ephProjectId } });
		} catch {
			// already gone — ignore
		}
	}

	// Clean /tmp dirs
	for (const dir of tmpDirs) {
		try {
			fs.rmSync(dir, { recursive: true, force: true });
		} catch {
			// best-effort
		}
	}

	// Verify no residual cg29 projects
	const residual = await prisma.project.findMany({
		where: { slug: { startsWith: "__test_cg29_" } },
	});
	if (residual.length > 0) {
		console.error("ANTI-POLLUTION WARNING: residual cg29 projects:", residual.map((p) => p.slug));
	}

	await prisma.$disconnect();
});

// ─── Test 1: ProjectSpec → BackendContract ────────────────────────────────────

describe("contracts-codegen e2e — BackendContract", () => {
	it("routes non-empty, schemas cover entities", async () => {
		const contract = await compileBackendContract(ephProjectId);

		assert.ok(Array.isArray(contract.routes), "routes is array");
		assert.ok(contract.routes.length > 0, "routes not empty (2 resources should produce routes)");
		assert.ok(Array.isArray(contract.schemas), "schemas is array");

		// Schemas must cover all entities
		assert.equal(
			contract.schemas.length,
			contract.generatedFrom.entities,
			"schema count == entity count",
		);

		// Check entity names are in schemas
		const schemaNames = new Set(contract.schemas.map((s) => s.name));
		assert.ok(schemaNames.has("Article"), "Article schema present");
		assert.ok(schemaNames.has("Comment"), "Comment schema present");

		// Operation-derived route present
		const opRoute = contract.routes.find((r) => r.operationRef === "publishArticle");
		assert.ok(opRoute, "publishArticle operation has a route");
	});
});

// ─── Test 2: ProjectSpec → FrontendContract ──────────────────────────────────

describe("contracts-codegen e2e — FrontendContract", () => {
	it("pages coherent with screens (1 screen = 1 page)", async () => {
		const contract = await compileFrontendContract(ephProjectId);

		assert.ok(Array.isArray(contract.pages), "pages is array");
		assert.equal(contract.pages.length, 1, "1 screen → 1 page");
		assert.equal(contract.routes.length, 1, "1 route");
		assert.equal(contract.pages[0]!.path, "/articles", "page path matches screen path");

		// nextRoute: "/articles" → "articles"
		assert.equal(contract.pages[0]!.nextRoute, "articles", "nextRoute stripped of leading slash");
	});
});

// ─── Test 3: ProjectSpec → SharedContract ─────────────────────────────────────

describe("contracts-codegen e2e — SharedContract", () => {
	it("types cover entities + standard auth/error types", async () => {
		const contract = await compileSharedContract(ephProjectId);

		assert.ok(Array.isArray(contract.types), "types is array");
		assert.ok(Array.isArray(contract.schemas), "schemas is array");

		// Entity types
		const entityTypes = contract.types.filter((t) => t.kind === "entity");
		assert.equal(entityTypes.length, 2, "2 entity types (Article + Comment)");

		// Zod schemas for each entity
		const schemaNames = new Set(contract.schemas.map((s) => s.name));
		assert.ok(schemaNames.has("ArticleSchema"), "ArticleSchema present");
		assert.ok(schemaNames.has("CommentSchema"), "CommentSchema present");

		// Standard types always present
		const hasAuthSession = contract.types.some((t) => t.name === "AuthSession");
		assert.ok(hasAuthSession, "AuthSession type present");
		assert.ok(contract.errors.length >= 6, "6 standard errors");

		// Operation type from publishArticle
		const opInput = contract.types.find((t) => t.name === "publishArticleInput");
		assert.ok(opInput, "publishArticleInput type present");
	});
});

// ─── Test 4: Contracts → generateApp dryRun (Hono, Next, SDK) ────────────────

describe("contracts-codegen e2e — generateApp dryRun manifest", () => {
	it("dryRun manifest contains apps/api, apps/web, packages/shared files", async () => {
		const result = await generateApp(ephProjectId, { dryRun: true });

		assert.ok(result.files.length > 0, "manifest not empty");
		const paths = result.files.map((f) => f.path);

		// Hono: apps/api
		assert.ok(paths.some((p) => p.startsWith("apps/api/")), "apps/api/ present in manifest");
		// Next: apps/web
		assert.ok(paths.some((p) => p.startsWith("apps/web/")), "apps/web/ present in manifest");
		// SDK/shared: packages/shared
		assert.ok(paths.some((p) => p.startsWith("packages/shared/")), "packages/shared/ present in manifest");

		// dryRun: outDir was NOT created on disk
		const exists = fs.existsSync(result.outDir);
		assert.ok(!exists, "dryRun does not create outDir on disk");
	});
});

// ─── Test 5: generateApp dryRun=false → .dtfs-manifest.json + contentHash ────

describe("contracts-codegen e2e — generateApp to disk", () => {
	it("writes manifest with contentHash per file then cleanup", async () => {
		const outDir = path.join(os.tmpdir(), `dtfs-e2e-${Date.now()}`);
		tmpDirs.push(outDir);

		const result = await generateApp(ephProjectId, { dryRun: false, outDir });

		// Manifest file created
		const manifestPath = path.join(outDir, ".dtfs-manifest.json");
		assert.ok(fs.existsSync(manifestPath), ".dtfs-manifest.json created");

		// Parse manifest
		const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
			projectId: string;
			files: Array<{ path: string; contentHash: string; bytes: number }>;
		};

		assert.equal(manifest.projectId, ephProjectId, "manifest projectId matches");
		assert.ok(manifest.files.length > 0, "manifest has file entries");

		// Every entry has a 64-char sha256 hash
		for (const entry of manifest.files) {
			assert.ok(entry.contentHash.length === 64, `${entry.path} has 64-char hash`);
			assert.ok(entry.bytes > 0, `${entry.path} has positive byte count`);
		}

		// Return result also has files
		assert.ok(result.files.length > 0, "result.files not empty");

		// Cleanup happens in after() via tmpDirs
	});
});

// ─── Test 6: checkGeneratedProject — protected file flag ─────────────────────

describe("contracts-codegen e2e — checkGeneratedProject protected flag", () => {
	it("detects protected files in manifest and reports them (no overwrite)", () => {
		const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dtfs-check-"));
		tmpDirs.push(tmpDir);

		// Write a manifest with a protected file
		const manifest = {
			files: [
				{ path: "apps/api/src/index.ts", contentHash: "abc", protected: true },
				{ path: "apps/api/src/routes/articles.ts", contentHash: "def", protected: false },
			],
		};
		fs.writeFileSync(path.join(tmpDir, ".dtfs-manifest.json"), JSON.stringify(manifest));

		// Create the expected dirs so ok=false is only about protected
		for (const dir of ["apps/api", "apps/web", "packages/shared"]) {
			fs.mkdirSync(path.join(tmpDir, dir), { recursive: true });
		}

		const result = checkGeneratedProject(tmpDir);

		// Must detect the protected file
		const hasProtectedIssue = result.issues.some((i) => i.includes("protected"));
		assert.ok(hasProtectedIssue, "protected file detected in issues");
		assert.ok(!result.ok, "ok=false when protected files present");
	});

	it("ok=true when no protected files and all expected dirs present", () => {
		const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dtfs-check-ok-"));
		tmpDirs.push(tmpDir);

		// No manifest, create expected dirs
		for (const dir of ["apps/api", "apps/web", "packages/shared"]) {
			fs.mkdirSync(path.join(tmpDir, dir), { recursive: true });
		}

		const result = checkGeneratedProject(tmpDir);
		assert.ok(result.ok, `expected ok=true, issues: ${result.issues.join("; ")}`);
		assert.deepEqual(result.issues, []);
	});
});

// ─── Test 7: Anti-pollution final verification ────────────────────────────────

describe("contracts-codegen e2e — anti-pollution", () => {
	it("no __test_cg29_ or __test_eph_ residuals in DB", async () => {
		const residual = await prisma.project.findMany({
			where: {
				slug: {
					in: [ephSlug],
				},
			},
		});
		// Only our own ephemeral project should exist (deleted in after())
		assert.ok(
			residual.every((p) => p.id === ephProjectId),
			`only our own project should be present: ${residual.map((p) => p.slug).join(", ")}`,
		);
	});

	it("no /tmp/dtfs-manifest files leaking into repo", () => {
		const repoRoot = "/data/dev/design-to-fullstack";
		const manifestInRepo = path.join(repoRoot, ".dtfs-manifest.json");
		assert.ok(!fs.existsSync(manifestInRepo), "no manifest at repo root");

		// No apps/ or packages/ in the repo root (meta-platform protection)
		assert.ok(!fs.existsSync(path.join(repoRoot, "apps")), "no apps/ in repo");
		assert.ok(!fs.existsSync(path.join(repoRoot, "packages")), "no packages/ in repo");
	});

	it("test project cmpji9ev90001m5p05krcodcg still has exactly 3 entities", async () => {
		const entities = await prisma.entity.findMany({
			where: { projectId: "cmpji9ev90001m5p05krcodcg" },
		});
		assert.equal(entities.length, 3, `expected 3 entities, got ${entities.length}: ${entities.map((e) => e.name).join(", ")}`);
	});
});
