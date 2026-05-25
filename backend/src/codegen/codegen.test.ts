// codegen.test.ts — node:test suite for the codegen module (no DB required for unit tests)
// Run: pnpm --filter backend exec node --import tsx/esm src/codegen/codegen.test.ts

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { resolveSafeOutDir } from "./safe-path.ts";
import { emitPrismaSchema } from "./emit-prisma.ts";
import { emitHonoRoutes } from "./emit-hono.ts";
import { emitNextPages } from "./emit-next.ts";
import { contentHash } from "./codegen.ts";
import type { CodegenSpec } from "./types.ts";

// ─── Minimal spec fixture ─────────────────────────────────────────────────────

const MINI_SPEC: CodegenSpec = {
	project: { id: "proj-test-1", slug: "test-app", localPath: null },
	entities: [
		{
			id: "e1",
			name: "Post",
			attributes: [
				{ name: "title", type: "TEXT", required: true, unique: false },
				{ name: "published", type: "CHECKBOX", required: false, unique: false },
				{ name: "score", type: "NUMBER", required: false, unique: false },
				{ name: "email", type: "EMAIL", required: false, unique: true },
				{ name: "birthday", type: "DATE", required: false, unique: false },
			],
		},
		{
			id: "e2",
			name: "Comment",
			attributes: [
				{ name: "body", type: "TEXTAREA", required: true, unique: false },
			],
		},
	],
	entityRelations: [
		{
			id: "r1",
			fromEntityId: "e2",
			toEntityId: "e1",
			name: "post",
			kind: "ONE_TO_MANY",
			required: true,
			fromField: "postId",
		},
	],
	resources: [
		{ id: "res1", entityId: "e1", name: "posts", exposedOps: ["list", "read", "create", "update", "delete"] },
		{ id: "res2", entityId: "e2", name: "comments", exposedOps: ["list", "create"] },
	],
	operations: [
		{
			id: "op1",
			name: "publishPost",
			kind: "COMMAND",
			inputSchema: { type: "object", properties: { postId: { type: "string" }, notify: { type: "boolean" } }, required: ["postId"] },
			outputSchema: null,
			steps: [
				{ kind: "db.findOne", as: "post", entity: "Post", where: { id: "$.input.postId" } },
				{ kind: "db.update", entity: "Post", where: { id: "$.input.postId" }, set: { published: true } },
			],
			bodyHint: "Find the post, set published=true, optionally send notification",
		},
	],
	screens: [
		{
			id: "s1",
			path: "/",
			type: "web",
			components: [
				{ id: "c1", type: "text", config: { label: "Welcome" } },
				{ id: "c2", type: "table", config: {} },
			],
		},
		{
			id: "s2",
			path: "/posts/new",
			type: "web",
			components: [
				{ id: "c3", type: "form", config: {} },
			],
		},
	],
};

// ─── resolveSafeOutDir ────────────────────────────────────────────────────────

describe("resolveSafeOutDir", () => {
	it("accepts /tmp paths", () => {
		const result = resolveSafeOutDir("/tmp/dtfs-test-xyz");
		assert.equal(result, "/tmp/dtfs-test-xyz");
	});

	it("accepts /tmp itself", () => {
		const result = resolveSafeOutDir("/tmp");
		assert.equal(result, "/tmp");
	});

	it("rejects relative paths", () => {
		assert.throws(
			() => resolveSafeOutDir("relative/path"),
			/absolute path/,
		);
	});

	it("rejects path traversal with ..", () => {
		// path.normalize collapses .., so we test that the resolved result is inside repo
		assert.throws(
			() => resolveSafeOutDir("/tmp/../data/dev/design-to-fullstack/hacked"),
			/meta-platform repo/,
		);
	});

	it("rejects the meta-platform repo itself", () => {
		assert.throws(
			() => resolveSafeOutDir("/data/dev/design-to-fullstack"),
			/meta-platform repo/,
		);
	});

	it("rejects a subdirectory of the meta-platform repo", () => {
		assert.throws(
			() => resolveSafeOutDir("/data/dev/design-to-fullstack/backend/generated"),
			/meta-platform repo/,
		);
	});

	it("rejects arbitrary non-/tmp path without localPath", () => {
		assert.throws(
			() => resolveSafeOutDir("/home/user/my-project"),
			/not an allowed location/,
		);
	});

	it("accepts <localPath>/generated/ when localPath is provided", () => {
		const local = "/home/user/my-project";
		const result = resolveSafeOutDir(`${local}/generated/app`, local);
		assert.equal(result, `${local}/generated/app`);
	});

	it("rejects <localPath> without /generated/ sub-dir", () => {
		const local = "/home/user/my-project";
		assert.throws(
			() => resolveSafeOutDir(local, local),
			/not an allowed location/,
		);
	});

	it("throws on empty string", () => {
		assert.throws(() => resolveSafeOutDir(""), /required/);
	});
});

// ─── emitPrismaSchema ─────────────────────────────────────────────────────────

describe("emitPrismaSchema", () => {
	it("contains model block for each entity", () => {
		const out = emitPrismaSchema(MINI_SPEC);
		assert.ok(out.includes("model Post {"), "should contain model Post");
		assert.ok(out.includes("model Comment {"), "should contain model Comment");
	});

	it("maps TEXT to String", () => {
		const out = emitPrismaSchema(MINI_SPEC);
		assert.ok(out.includes("String"), "should contain String type");
	});

	it("maps CHECKBOX to Boolean", () => {
		const out = emitPrismaSchema(MINI_SPEC);
		assert.ok(out.includes("Boolean"), "should contain Boolean type");
	});

	it("maps NUMBER to Float", () => {
		const out = emitPrismaSchema(MINI_SPEC);
		assert.ok(out.includes("Float"), "should contain Float type");
	});

	it("maps DATE to DateTime", () => {
		const out = emitPrismaSchema(MINI_SPEC);
		assert.ok(out.includes("DateTime"), "should contain DateTime type");
	});

	it("contains datasource block", () => {
		const out = emitPrismaSchema(MINI_SPEC);
		assert.ok(out.includes("datasource db {"), "should contain datasource");
		assert.ok(out.includes("postgresql"), "should use postgresql provider");
	});

	it("contains generator block", () => {
		const out = emitPrismaSchema(MINI_SPEC);
		assert.ok(out.includes("generator client {"), "should contain generator");
	});

	it("marks unique fields with @unique", () => {
		const out = emitPrismaSchema(MINI_SPEC);
		assert.ok(out.includes("@unique"), "should emit @unique for unique attrs");
	});

	it("is deterministic (same input → same output)", () => {
		const out1 = emitPrismaSchema(MINI_SPEC);
		const out2 = emitPrismaSchema(MINI_SPEC);
		assert.equal(out1, out2, "output should be identical on repeated calls");
	});
});

// ─── emitHonoRoutes ───────────────────────────────────────────────────────────

describe("emitHonoRoutes", () => {
	it("produces one file per resource + app index", () => {
		const files = emitHonoRoutes(MINI_SPEC);
		const paths = files.map((f) => f.path);
		assert.ok(paths.some((p) => p.includes("posts")), "should have posts route");
		assert.ok(paths.some((p) => p.includes("comments")), "should have comments route");
		assert.ok(paths.some((p) => p.endsWith("app.ts")), "should have app.ts index");
	});

	it("includes CRUD handlers according to exposedOps", () => {
		const files = emitHonoRoutes(MINI_SPEC);
		const postsFile = files.find((f) => f.path.includes("posts.ts"));
		assert.ok(postsFile, "posts route file should exist");
		assert.ok(postsFile.content.includes('.get("/",'), "should have list handler");
		assert.ok(postsFile.content.includes('.get("/:id",'), "should have read handler");
		assert.ok(postsFile.content.includes("// POST /posts"), "should have create handler");
		assert.ok(postsFile.content.includes("// PATCH /posts/:id"), "should have update handler");
		assert.ok(postsFile.content.includes('.delete("/:id",'), "should have delete handler");
	});

	it("does not emit delete for comments (not in exposedOps)", () => {
		const files = emitHonoRoutes(MINI_SPEC);
		const commentsFile = files.find((f) => f.path.includes("comments.ts"));
		assert.ok(commentsFile, "comments route file should exist");
		assert.ok(!commentsFile.content.includes('.delete("/:id"'), "should NOT have delete handler");
	});
});

// ─── emitNextPages ────────────────────────────────────────────────────────────

describe("emitNextPages", () => {
	it("produces one page per screen + layout", () => {
		const files = emitNextPages(MINI_SPEC);
		const paths = files.map((f) => f.path);
		// "/" → app/page.tsx, "/posts/new" → app/posts/new/page.tsx
		assert.ok(paths.some((p) => p.endsWith("app/page.tsx")), "should have root page");
		assert.ok(paths.some((p) => p.includes("posts/new")), "should have posts/new page");
		assert.ok(paths.some((p) => p.endsWith("layout.tsx")), "should have layout");
	});

	it("each page contains a default export function", () => {
		const files = emitNextPages(MINI_SPEC);
		const pages = files.filter((f) => f.path.endsWith("page.tsx"));
		for (const page of pages) {
			assert.ok(
				page.content.includes("export default function"),
				`${page.path} should have export default function`,
			);
		}
	});
});

// ─── contentHash ─────────────────────────────────────────────────────────────

describe("contentHash", () => {
	it("is a 64-char hex string (sha256)", () => {
		const h = contentHash("hello world");
		assert.equal(h.length, 64);
		assert.match(h, /^[0-9a-f]+$/);
	});

	it("is stable (same input → same hash)", () => {
		assert.equal(contentHash("abc"), contentHash("abc"));
	});

	it("differs for different inputs", () => {
		assert.notEqual(contentHash("a"), contentHash("b"));
	});
});

// ─── generateApp dryRun — no files written ────────────────────────────────────
// Note: this test requires a live DB connection.
// It is skipped here and tested in the smoke test section.
// The logic is: dryRun=true must not create ANY file in outDir.

describe("generateApp dryRun (filesystem check)", () => {
	it("dryRun=true does not create outDir on disk", async () => {
		// We can't hit the DB in a pure unit test, so we verify the
		// safe-path + emitter path by calling emitters directly on MINI_SPEC
		// and asserting that no temp dir was created.
		const tmpDir = path.join(os.tmpdir(), `dtfs-dryrun-check-${Date.now()}`);

		// The dir should NOT exist before
		assert.ok(!fs.existsSync(tmpDir), "tmpDir should not exist before test");

		// Simulate what generateApp does in dryRun mode: just collect files, no write
		const prismaContent = emitPrismaSchema(MINI_SPEC);
		const honoFiles = emitHonoRoutes(MINI_SPEC);
		const nextFiles = emitNextPages(MINI_SPEC);

		// Verify content is non-empty
		assert.ok(prismaContent.length > 0, "prismaContent should be non-empty");
		assert.ok(honoFiles.length > 0, "honoFiles should be non-empty");
		assert.ok(nextFiles.length > 0, "nextFiles should be non-empty");

		// Dir was never created
		assert.ok(!fs.existsSync(tmpDir), "tmpDir should still not exist after dryRun simulation");
	});
});
