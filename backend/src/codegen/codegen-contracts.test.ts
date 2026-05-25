// codegen-contracts.test.ts — Phase 28 contract-driven codegen tests.
// Covers: emit-shared, planCodegen, generateBackendApi dry-run, diffGeneratedArtifacts,
// resolveSafeOutDir (re-assert), generateApp contract-driven dry-run, new arborescence.
//
// Run: pnpm --filter backend exec node --import tsx/esm --env-file=../.env src/codegen/codegen-contracts.test.ts

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { resolveSafeOutDir } from "./safe-path";
import { emitSharedPackage } from "./emit-shared";
import { emitAuthRuntime } from "./emit-auth";
import { emitHonoBackendApi } from "./emit-hono";
import { emitNextFrontend } from "./emit-next";
import { emitSdk } from "./emit-sdk";
import { emitTests } from "./emit-tests";
import { diffGeneratedArtifacts, contentHash, planCodegen, generateBackendApi, generateApp } from "./codegen";
import type { SharedContractObj } from "../lib/contracts/compile-shared";
import type { BackendContractObj } from "../lib/contracts/compile-backend";
import type { FrontendContractObj } from "../lib/contracts/compile-frontend";

// ─── Minimal contract fixtures ────────────────────────────────────────────────

const MINI_SHARED: SharedContractObj = {
	types: [
		{
			name: "Post",
			kind: "entity",
			fields: [
				{ name: "title", type: "string", required: true },
				{ name: "published", type: "boolean", required: false },
			],
			description: "DTO for Post",
		},
		{
			name: "CreatePostInput",
			kind: "operation-input",
			fields: [{ name: "title", type: "string", required: true }],
		},
		{
			name: "AuthSession",
			kind: "auth",
			fields: [
				{ name: "userId", type: "string", required: true },
				{ name: "email", type: "string", required: true },
			],
			description: "Better Auth session shape",
		},
		{
			name: "ApiError",
			kind: "error",
			fields: [
				{ name: "code", type: "string", required: true },
				{ name: "message", type: "string", required: true },
				{ name: "httpStatus", type: "number", required: true },
			],
		},
	],
	schemas: [
		{
			name: "PostSchema",
			zodSchema: `z.object({\n  title: z.string(),\n  published: z.boolean().optional()\n})`,
		},
	],
	apiClient: {
		baseUrl: "/api",
		operations: [
			{
				name: "publishPost",
				method: "POST",
				path: "/api/operations/publishPost",
				inputType: "publishPostInput",
				outputType: "publishPostOutput",
			},
		],
	},
	errors: [
		{ code: "NOT_FOUND", message: "Resource not found", httpStatus: 404 },
		{ code: "UNAUTHORIZED", message: "Authentication required", httpStatus: 401 },
	],
	events: [],
};

const MINI_BACKEND: BackendContractObj = {
	apiBasePath: "/api",
	routes: [
		{
			method: "GET",
			path: "/api/posts",
			resourceRef: "posts",
			schemaRef: "Post",
			middlewares: [],
			description: "List Post records",
		},
		{
			method: "POST",
			path: "/api/posts",
			resourceRef: "posts",
			schemaRef: "Post",
			middlewares: [],
			description: "Create a new Post",
		},
		{
			method: "GET",
			path: "/api/posts/:id",
			resourceRef: "posts",
			schemaRef: "Post",
			middlewares: [],
			description: "Read one Post by id",
		},
	],
	schemas: [
		{
			name: "Post",
			entityName: "Post",
			fields: [
				{ name: "title", type: "string", required: true, unique: false },
				{ name: "published", type: "boolean", required: false, unique: false },
			],
		},
	],
	middlewares: [],
	auth: {
		provider: "better-auth",
		basePath: "/api/auth",
		methods: [{ name: "email-password", kind: "EMAIL_PASSWORD" }],
	},
	errors: [
		{ code: "NOT_FOUND", message: "Resource not found" },
		{ code: "UNAUTHORIZED", message: "Authentication required" },
	],
	generatedFrom: { entities: 1, resources: 1, operations: 0, policies: 0, authMethods: 1 },
};

const MINI_FRONTEND: FrontendContractObj = {
	routes: [
		{ path: "/", nextRoute: "", screenId: "s1" },
		{ path: "/posts", nextRoute: "posts", screenId: "s2" },
	],
	pages: [
		{ screenId: "s1", path: "/", nextRoute: "", type: "web", titleKey: null, componentCount: 1 },
		{ screenId: "s2", path: "/posts", nextRoute: "posts", type: "web", titleKey: null, componentCount: 2 },
	],
	layouts: [{ name: "RootLayout", path: "app/layout.tsx" }],
	components: [
		{ componentId: "c1", type: "text", screenId: "s1" },
		{ componentId: "c2", type: "table", screenId: "s2" },
	],
	forms: [],
	dataBindings: [],
	actions: [],
	authGuards: [],
	generatedFrom: { screens: 2, components: 2, forms: 0, actions: 0, dataBindings: 0 },
};

// ─── resolveSafeOutDir (re-assert Phase 17 guarantees) ───────────────────────

describe("resolveSafeOutDir Phase 28 re-assert", () => {
	it("accepts /tmp paths", () => {
		assert.equal(resolveSafeOutDir("/tmp/dtfs-28-test"), "/tmp/dtfs-28-test");
	});

	it("rejects meta-platform repo", () => {
		assert.throws(
			() => resolveSafeOutDir("/data/dev/design-to-fullstack/apps/api"),
			/meta-platform repo/,
		);
	});

	it("rejects relative paths", () => {
		assert.throws(() => resolveSafeOutDir("relative/path"), /absolute path/);
	});

	it("accepts localPath/generated sub-dir", () => {
		const local = "/home/user/my-project";
		assert.equal(resolveSafeOutDir(`${local}/generated/app`, local), `${local}/generated/app`);
	});
});

// ─── emit-shared from SharedContractObj ──────────────────────────────────────

describe("emitSharedPackage", () => {
	it("emits 5 files including schemas, types, errors, api-contract, index", () => {
		const files = emitSharedPackage(MINI_SHARED);
		assert.equal(files.length, 5);
		const paths = files.map((f) => f.path);
		assert.ok(paths.some((p) => p.includes("schemas/index.ts")), "should have schemas");
		assert.ok(paths.some((p) => p.includes("types/index.ts")), "should have types");
		assert.ok(paths.some((p) => p.endsWith("errors.ts")), "should have errors");
		assert.ok(paths.some((p) => p.endsWith("api-contract.ts")), "should have api-contract");
		assert.ok(paths.some((p) => p.endsWith("index.ts") && p.includes("packages/shared/src/index")), "should have barrel");
	});

	it("schemas/index.ts contains Zod schema", () => {
		const files = emitSharedPackage(MINI_SHARED);
		const schemasFile = files.find((f) => f.path.includes("schemas/index.ts"));
		assert.ok(schemasFile, "schemas file should exist");
		assert.ok(schemasFile.content.includes("PostSchema"), "should contain PostSchema");
		assert.ok(schemasFile.content.includes("z.object"), "should contain z.object");
	});

	it("types/index.ts contains entity type fields", () => {
		const files = emitSharedPackage(MINI_SHARED);
		const typesFile = files.find((f) => f.path.includes("types/index.ts"));
		assert.ok(typesFile, "types file should exist");
		assert.ok(typesFile.content.includes("title"), "should contain title field");
	});

	it("errors.ts contains error codes", () => {
		const files = emitSharedPackage(MINI_SHARED);
		const errorsFile = files.find((f) => f.path.endsWith("errors.ts"));
		assert.ok(errorsFile, "errors file should exist");
		assert.ok(errorsFile.content.includes("NOT_FOUND"), "should contain NOT_FOUND");
		assert.ok(errorsFile.content.includes("UNAUTHORIZED"), "should contain UNAUTHORIZED");
		assert.ok(errorsFile.content.includes("ApiErrorCode"), "should export ApiErrorCode");
	});

	it("api-contract.ts contains API_BASE_URL and API_OPERATIONS", () => {
		const files = emitSharedPackage(MINI_SHARED);
		const contractFile = files.find((f) => f.path.endsWith("api-contract.ts"));
		assert.ok(contractFile, "api-contract file should exist");
		assert.ok(contractFile.content.includes("API_BASE_URL"), "should contain API_BASE_URL");
		assert.ok(contractFile.content.includes("API_OPERATIONS"), "should contain API_OPERATIONS");
		assert.ok(contractFile.content.includes("publishPost"), "should contain publishPost operation");
	});

	it("all files have non-empty content", () => {
		const files = emitSharedPackage(MINI_SHARED);
		for (const file of files) {
			assert.ok(file.content.length > 0, `${file.path} should have content`);
		}
	});
});

// ─── emit-auth from BackendContractObj ───────────────────────────────────────

describe("emitAuthRuntime", () => {
	it("emits exactly 1 file: apps/api/src/auth.ts", () => {
		const files = emitAuthRuntime(MINI_BACKEND);
		assert.equal(files.length, 1);
		const file = files[0];
		assert.ok(file, "file should exist");
		assert.equal(file.path, "apps/api/src/auth.ts");
	});

	it("includes betterAuth import and auth config", () => {
		const files = emitAuthRuntime(MINI_BACKEND);
		const file = files[0];
		assert.ok(file, "file should exist");
		const content = file.content;
		assert.ok(content.includes("betterAuth"), "should import betterAuth");
		assert.ok(content.includes("/api/auth"), "should include basePath");
		assert.ok(content.includes("emailAndPassword"), "should include emailAndPassword config");
	});

	it("enables emailAndPassword when EMAIL_PASSWORD method present", () => {
		const files = emitAuthRuntime(MINI_BACKEND);
		const file = files[0];
		assert.ok(file, "file should exist");
		assert.ok(file.content.includes("enabled: true"), "should enable email/password");
	});
});

// ─── emitHonoBackendApi from BackendContractObj ───────────────────────────────

describe("emitHonoBackendApi (contract-driven)", () => {
	it("emits route file for 'posts' resource", () => {
		const files = emitHonoBackendApi(MINI_BACKEND);
		const paths = files.map((f) => f.path);
		assert.ok(paths.some((p) => p.includes("routes/posts.ts")), "should have posts route");
	});

	it("emits apps/api/src/index.ts", () => {
		const files = emitHonoBackendApi(MINI_BACKEND);
		const paths = files.map((f) => f.path);
		assert.ok(paths.some((p) => p === "apps/api/src/index.ts"), "should have index.ts");
	});

	it("emits repository stub for Post", () => {
		const files = emitHonoBackendApi(MINI_BACKEND);
		const paths = files.map((f) => f.path);
		assert.ok(paths.some((p) => p.includes("repositories/post.repository.ts")), "should have post repository");
	});

	it("route file has non-empty content with GET handler", () => {
		const files = emitHonoBackendApi(MINI_BACKEND);
		const postsRoute = files.find((f) => f.path.includes("routes/posts.ts"));
		assert.ok(postsRoute, "posts route should exist");
		assert.ok(postsRoute.content.includes(".get("), "should have GET handler");
		assert.ok(postsRoute.content.length > 100, "content should be substantial");
	});

	it("index.ts uses contract-driven structure (apps/api/src/index.ts)", () => {
		const files = emitHonoBackendApi(MINI_BACKEND);
		const index = files.find((f) => f.path === "apps/api/src/index.ts");
		assert.ok(index, "index.ts should exist");
		assert.ok(index.content.includes("Hono"), "should import Hono");
		assert.ok(index.content.includes("AppType"), "should export AppType");
	});
});

// ─── emitNextFrontend from FrontendContractObj ────────────────────────────────

describe("emitNextFrontend (contract-driven)", () => {
	it("emits page files for each screen", () => {
		const files = emitNextFrontend(MINI_FRONTEND);
		const paths = files.map((f) => f.path);
		assert.ok(paths.some((p) => p.includes("apps/web/app/")), "should have app/ pages");
	});

	it("emits layout", () => {
		const files = emitNextFrontend(MINI_FRONTEND);
		const paths = files.map((f) => f.path);
		assert.ok(paths.some((p) => p.endsWith("layout.tsx")), "should have layout");
	});

	it("emits lib/api/client.ts", () => {
		const files = emitNextFrontend(MINI_FRONTEND);
		const paths = files.map((f) => f.path);
		assert.ok(paths.some((p) => p.endsWith("lib/api/client.ts")), "should have api client");
	});

	it("pages have export default function", () => {
		const files = emitNextFrontend(MINI_FRONTEND);
		const pages = files.filter((f) => f.path.endsWith("page.tsx"));
		assert.ok(pages.length > 0, "should have at least one page");
		for (const page of pages) {
			assert.ok(page.content.includes("export default function"), `${page.path} should have export default function`);
		}
	});
});

// ─── emitSdk from SharedContractObj ──────────────────────────────────────────

describe("emitSdk", () => {
	it("emits 2 files: client.ts and index.ts", () => {
		const files = emitSdk(MINI_SHARED);
		assert.equal(files.length, 2);
		const paths = files.map((f) => f.path);
		assert.ok(paths.some((p) => p.endsWith("sdk/client.ts")), "should have client.ts");
		assert.ok(paths.some((p) => p.endsWith("sdk/index.ts")), "should have index.ts");
	});

	it("client.ts contains typed function for each operation", () => {
		const files = emitSdk(MINI_SHARED);
		const client = files.find((f) => f.path.endsWith("client.ts"));
		assert.ok(client, "client.ts should exist");
		assert.ok(client.content.includes("publishPost"), "should have publishPost function");
		assert.ok(client.content.includes("async function call"), "should have call helper");
	});
});

// ─── emitTests ────────────────────────────────────────────────────────────────

describe("emitTests", () => {
	it("emits test files for API routes", () => {
		const files = emitTests(MINI_BACKEND, MINI_SHARED);
		const paths = files.map((f) => f.path);
		assert.ok(paths.some((p) => p.includes("tests/api/")), "should have api tests");
	});

	it("emits contract tests", () => {
		const files = emitTests(MINI_BACKEND, MINI_SHARED);
		const paths = files.map((f) => f.path);
		assert.ok(paths.some((p) => p.includes("tests/contract/")), "should have contract tests");
	});

	it("emits e2e smoke test", () => {
		const files = emitTests(MINI_BACKEND, MINI_SHARED);
		const paths = files.map((f) => f.path);
		assert.ok(paths.some((p) => p.includes("tests/e2e/")), "should have e2e tests");
	});

	it("all test files have kind=TEST", () => {
		const files = emitTests(MINI_BACKEND, MINI_SHARED);
		for (const file of files) {
			assert.equal(file.kind, "TEST", `${file.path} should have kind=TEST`);
		}
	});
});

// ─── diffGeneratedArtifacts ───────────────────────────────────────────────────

describe("diffGeneratedArtifacts", () => {
	it("detects added file (B has file A does not)", () => {
		const tmpA = fs.mkdtempSync(path.join(os.tmpdir(), "dtfs-diff-a-"));
		const tmpB = fs.mkdtempSync(path.join(os.tmpdir(), "dtfs-diff-b-"));

		try {
			const manifestA = {
				files: [
					{ path: "prisma/schema.prisma", contentHash: contentHash("schema content v1") },
				],
			};
			const manifestB = {
				files: [
					{ path: "prisma/schema.prisma", contentHash: contentHash("schema content v1") },
					{ path: "apps/api/src/index.ts", contentHash: contentHash("index content") },
				],
			};

			fs.writeFileSync(path.join(tmpA, ".dtfs-manifest.json"), JSON.stringify(manifestA));
			fs.writeFileSync(path.join(tmpB, ".dtfs-manifest.json"), JSON.stringify(manifestB));

			const diff = diffGeneratedArtifacts("proj-test", tmpA, tmpB);
			assert.deepEqual(diff.added, ["apps/api/src/index.ts"]);
			assert.deepEqual(diff.removed, []);
			assert.deepEqual(diff.changed, []);
		} finally {
			fs.rmSync(tmpA, { recursive: true, force: true });
			fs.rmSync(tmpB, { recursive: true, force: true });
		}
	});

	it("detects removed file (A has file B does not)", () => {
		const tmpA = fs.mkdtempSync(path.join(os.tmpdir(), "dtfs-diff-a-"));
		const tmpB = fs.mkdtempSync(path.join(os.tmpdir(), "dtfs-diff-b-"));

		try {
			const manifestA = {
				files: [
					{ path: "prisma/schema.prisma", contentHash: contentHash("schema v1") },
					{ path: "legacy/file.ts", contentHash: contentHash("old content") },
				],
			};
			const manifestB = {
				files: [
					{ path: "prisma/schema.prisma", contentHash: contentHash("schema v1") },
				],
			};

			fs.writeFileSync(path.join(tmpA, ".dtfs-manifest.json"), JSON.stringify(manifestA));
			fs.writeFileSync(path.join(tmpB, ".dtfs-manifest.json"), JSON.stringify(manifestB));

			const diff = diffGeneratedArtifacts("proj-test", tmpA, tmpB);
			assert.deepEqual(diff.removed, ["legacy/file.ts"]);
			assert.deepEqual(diff.added, []);
			assert.deepEqual(diff.changed, []);
		} finally {
			fs.rmSync(tmpA, { recursive: true, force: true });
			fs.rmSync(tmpB, { recursive: true, force: true });
		}
	});

	it("detects changed file (same path, different hash)", () => {
		const tmpA = fs.mkdtempSync(path.join(os.tmpdir(), "dtfs-diff-a-"));
		const tmpB = fs.mkdtempSync(path.join(os.tmpdir(), "dtfs-diff-b-"));

		try {
			const manifestA = {
				files: [
					{ path: "prisma/schema.prisma", contentHash: contentHash("schema v1") },
				],
			};
			const manifestB = {
				files: [
					{ path: "prisma/schema.prisma", contentHash: contentHash("schema v2 — changed") },
				],
			};

			fs.writeFileSync(path.join(tmpA, ".dtfs-manifest.json"), JSON.stringify(manifestA));
			fs.writeFileSync(path.join(tmpB, ".dtfs-manifest.json"), JSON.stringify(manifestB));

			const diff = diffGeneratedArtifacts("proj-test", tmpA, tmpB);
			assert.deepEqual(diff.changed, ["prisma/schema.prisma"]);
			assert.deepEqual(diff.added, []);
			assert.deepEqual(diff.removed, []);
		} finally {
			fs.rmSync(tmpA, { recursive: true, force: true });
			fs.rmSync(tmpB, { recursive: true, force: true });
		}
	});

	it("returns all-empty diff for identical manifests", () => {
		const tmpA = fs.mkdtempSync(path.join(os.tmpdir(), "dtfs-diff-a-"));
		const tmpB = fs.mkdtempSync(path.join(os.tmpdir(), "dtfs-diff-b-"));

		try {
			const manifest = {
				files: [
					{ path: "prisma/schema.prisma", contentHash: contentHash("same") },
				],
			};
			fs.writeFileSync(path.join(tmpA, ".dtfs-manifest.json"), JSON.stringify(manifest));
			fs.writeFileSync(path.join(tmpB, ".dtfs-manifest.json"), JSON.stringify(manifest));

			const diff = diffGeneratedArtifacts("proj-test", tmpA, tmpB);
			assert.deepEqual(diff, { added: [], removed: [], changed: [] });
		} finally {
			fs.rmSync(tmpA, { recursive: true, force: true });
			fs.rmSync(tmpB, { recursive: true, force: true });
		}
	});

	it("handles missing manifest gracefully (returns added for all B files)", () => {
		const tmpA = fs.mkdtempSync(path.join(os.tmpdir(), "dtfs-diff-a-"));
		const tmpB = fs.mkdtempSync(path.join(os.tmpdir(), "dtfs-diff-b-"));

		try {
			// No manifest in A
			const manifestB = { files: [{ path: "apps/api/src/index.ts", contentHash: contentHash("content") }] };
			fs.writeFileSync(path.join(tmpB, ".dtfs-manifest.json"), JSON.stringify(manifestB));

			const diff = diffGeneratedArtifacts("proj-test", tmpA, tmpB);
			assert.ok(diff.added.includes("apps/api/src/index.ts"), "should report added file");
		} finally {
			fs.rmSync(tmpA, { recursive: true, force: true });
			fs.rmSync(tmpB, { recursive: true, force: true });
		}
	});
});

// ─── planCodegen (requires DB) ────────────────────────────────────────────────

describe("planCodegen (DB)", () => {
	const TEST_PID = process.env["TEST_PROJECT_ID"];

	it("returns correct layer order: database before backend, shared before sdk", { skip: !TEST_PID }, async () => {
		const result = await planCodegen(TEST_PID as string);
		assert.ok(Array.isArray(result.order), "order should be an array");
		const order = result.order;
		const dbIdx = order.indexOf("database");
		const backendIdx = order.indexOf("backend");
		const sharedIdx = order.indexOf("shared");
		const sdkIdx = order.indexOf("sdk");
		assert.ok(dbIdx >= 0, "database should be in order");
		assert.ok(backendIdx >= 0, "backend should be in order");
		assert.ok(dbIdx < backendIdx, "database should come before backend");
		assert.ok(sharedIdx < sdkIdx, "shared should come before sdk");
	});

	it("includes all 7 granular layers in order", { skip: !TEST_PID }, async () => {
		const result = await planCodegen(TEST_PID as string);
		const expected = ["database", "shared", "auth", "backend", "frontend", "sdk", "tests"];
		for (const layer of expected) {
			assert.ok(result.order.includes(layer as never), `order should include ${layer}`);
		}
	});

	it("layers map has description and estimatedFiles for each", { skip: !TEST_PID }, async () => {
		const result = await planCodegen(TEST_PID as string);
		for (const layer of result.order) {
			assert.ok(result.layers[layer].description, `${layer} should have description`);
			assert.ok(typeof result.layers[layer].estimatedFiles === "number", `${layer} should have estimatedFiles`);
		}
	});
});

// ─── generateBackendApi dry-run (requires DB) ────────────────────────────────

describe("generateBackendApi dry-run (DB)", () => {
	const TEST_PID = process.env["TEST_PROJECT_ID"];

	it("generates route files without writing to disk", { skip: !TEST_PID }, async () => {
		const result = await generateBackendApi(TEST_PID as string, { dryRun: true });
		assert.ok(result.files.length > 0, "should produce at least one file");
		const paths = result.files.map((f) => f.path);
		// Should produce apps/api/src/index.ts at minimum
		assert.ok(
			paths.some((p) => p === "apps/api/src/index.ts"),
			"should include apps/api/src/index.ts",
		);
		// Verify no files were actually written
		const tmpDir = result.outDir;
		// In dryRun mode, the outDir should not contain generated files
		const indexExists = fs.existsSync(path.join(tmpDir, "apps/api/src/index.ts"));
		assert.ok(!indexExists, "dryRun should not write files to disk");
	});

	it("all route files have non-empty contentHash", { skip: !TEST_PID }, async () => {
		const result = await generateBackendApi(TEST_PID as string, { dryRun: true });
		for (const f of result.files) {
			assert.ok(f.contentHash.length === 64, `${f.path} should have 64-char SHA-256 hash`);
			assert.ok(f.bytes > 0, `${f.path} should have positive byte count`);
		}
	});
});

// ─── generateApp contract-driven dry-run (requires DB) ───────────────────────

describe("generateApp contract-driven (DB)", () => {
	const TEST_PID = process.env["TEST_PROJECT_ID"];

	it("dryRun=true produces new arborescence (apps/api, packages/shared)", { skip: !TEST_PID }, async () => {
		const result = await generateApp(TEST_PID as string, { dryRun: true });
		assert.ok(result.files.length > 0, "should produce files");
		const paths = result.files.map((f) => f.path);

		// New arborescence: apps/api, packages/shared, prisma/
		assert.ok(
			paths.some((p) => p.startsWith("apps/api/")),
			"should include apps/api/ files",
		);
		assert.ok(
			paths.some((p) => p.startsWith("packages/shared/")),
			"should include packages/shared/ files",
		);
		assert.ok(
			paths.some((p) => p === "prisma/schema.prisma"),
			"should include prisma/schema.prisma",
		);
	});

	it("counts.sharedFiles > 0", { skip: !TEST_PID }, async () => {
		const result = await generateApp(TEST_PID as string, { dryRun: true });
		assert.ok((result.counts.sharedFiles ?? 0) > 0, "sharedFiles count should be positive");
	});

	it("dryRun=true does not create outDir on disk", { skip: !TEST_PID }, async () => {
		const customOutDir = `/tmp/dtfs-cg28-dryrun-check-${Date.now()}`;
		const result = await generateApp(TEST_PID as string, {
			dryRun: true,
			outDir: customOutDir,
		});
		assert.ok(result.files.length > 0, "should produce files in memory");
		// Dir should NOT exist since dryRun
		const exists = fs.existsSync(customOutDir);
		assert.ok(!exists, "dryRun should not create outDir on disk");
	});

	it("layer='database' only emits prisma/schema.prisma", { skip: !TEST_PID }, async () => {
		const result = await generateApp(TEST_PID as string, {
			dryRun: true,
			layer: "database",
		});
		assert.ok(result.files.length >= 1, "should produce at least 1 file");
		assert.equal(result.counts.prismaSchema, 1, "should have exactly 1 prisma schema");
		const paths = result.files.map((f) => f.path);
		assert.ok(paths.every((p) => p.includes("schema.prisma")), "all files should be schema.prisma");
	});

	it("layer='shared' emits packages/shared files", { skip: !TEST_PID }, async () => {
		const result = await generateApp(TEST_PID as string, {
			dryRun: true,
			layer: "shared",
		});
		const paths = result.files.map((f) => f.path);
		assert.ok(
			paths.every((p) => p.startsWith("packages/shared/")),
			"all shared-layer files should be in packages/shared/",
		);
	});
});

// ─── Anti-pollution check ─────────────────────────────────────────────────────

describe("Phase 28 anti-pollution", () => {
	it("no generated files in meta-platform repo after dry-run tests", () => {
		// Check that the test fixtures above did not write anything into the repo
		const repoRoot = "/data/dev/design-to-fullstack";
		const appsApi = path.join(repoRoot, "apps/api");
		const packagesShared = path.join(repoRoot, "packages/shared");
		assert.ok(!fs.existsSync(appsApi), `apps/api should not exist in repo: ${appsApi}`);
		assert.ok(!fs.existsSync(packagesShared), `packages/shared should not exist in repo: ${packagesShared}`);
	});

	it("resolveSafeOutDir rejects meta-platform repo subpaths for new arborescences", () => {
		const repoPaths = [
			"/data/dev/design-to-fullstack/apps/api",
			"/data/dev/design-to-fullstack/packages/shared",
			"/data/dev/design-to-fullstack/prisma",
			"/data/dev/design-to-fullstack/tests",
		];
		for (const p of repoPaths) {
			assert.throws(
				() => resolveSafeOutDir(p),
				/meta-platform repo/,
				`${p} should be rejected`,
			);
		}
	});
});
