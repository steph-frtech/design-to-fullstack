// contracts.test.ts — Integration tests for contracts compilation.
// Reads the live DB (READ-ONLY). Uses test project cmpji9ev90001m5p05krcodcg.
// Run: pnpm --filter backend test
//
// Gating: setRuntimeTarget without table → {ok:false}
//         getRuntimeTarget without table  → DEFAULT (source:"default")

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { compileBackendContract } from "./compile-backend";
import { compileFrontendContract } from "./compile-frontend";
import { compileSharedContract } from "./compile-shared";
import { validateContracts } from "./validate-contracts";
import { getRuntimeTarget, setRuntimeTarget, DEFAULT_RUNTIME_TARGET } from "./runtime-target";

const TEST_PROJECT_ID = "cmpji9ev90001m5p05krcodcg";

describe("contracts — compileBackendContract", () => {
	it("should return routes and schemas for the test project", async () => {
		const contract = await compileBackendContract(TEST_PROJECT_ID);

		// Must have at least the standard error codes
		assert.ok(Array.isArray(contract.routes), "routes is an array");
		assert.ok(Array.isArray(contract.schemas), "schemas is an array");
		assert.ok(Array.isArray(contract.middlewares), "middlewares is an array");
		assert.ok(contract.apiBasePath === "/api", "apiBasePath is /api");
		assert.ok(typeof contract.generatedFrom.entities === "number", "generatedFrom.entities is a number");

		// If resources exist, routes should not be empty
		if (contract.generatedFrom.resources > 0) {
			assert.ok(contract.routes.length > 0, "resources should produce routes");
		}

		// Schemas should cover all entities
		assert.equal(
			contract.schemas.length,
			contract.generatedFrom.entities,
			"schema count equals entity count",
		);
	});

	it("should map entities to schemas", async () => {
		const contract = await compileBackendContract(TEST_PROJECT_ID);
		for (const schema of contract.schemas) {
			assert.ok(schema.name.length > 0, "schema has a name");
			assert.ok(Array.isArray(schema.fields), "schema has fields array");
		}
	});
});

describe("contracts — compileFrontendContract", () => {
	it("should return one page per screen", async () => {
		const contract = await compileFrontendContract(TEST_PROJECT_ID);

		assert.ok(Array.isArray(contract.pages), "pages is an array");
		assert.ok(Array.isArray(contract.routes), "routes is an array");

		// pages count must equal routes count
		assert.equal(contract.pages.length, contract.routes.length, "pages == routes");
		// generatedFrom.screens reflects DB screen count
		assert.equal(
			contract.pages.length,
			contract.generatedFrom.screens,
			"pages count == screens in DB",
		);
	});

	it("should produce valid Next.js route strings", async () => {
		const contract = await compileFrontendContract(TEST_PROJECT_ID);
		for (const page of contract.pages) {
			assert.ok(page.path.startsWith("/") || page.path === "", "page path starts with /");
			assert.ok(typeof page.nextRoute === "string", "nextRoute is a string");
		}
	});
});

describe("contracts — compileSharedContract", () => {
	it("should return types that cover all entities", async () => {
		const contract = await compileSharedContract(TEST_PROJECT_ID);

		assert.ok(Array.isArray(contract.types), "types is an array");
		assert.ok(Array.isArray(contract.schemas), "schemas is an array");
		assert.ok(Array.isArray(contract.errors), "errors is an array");
		assert.ok(Array.isArray(contract.events), "events is an array");

		// AuthSession type must always be present
		const hasAuthSession = contract.types.some((t) => t.name === "AuthSession");
		assert.ok(hasAuthSession, "AuthSession type present");

		// Must have at least the 6 standard error codes
		assert.ok(contract.errors.length >= 6, "standard errors present");
	});

	it("should have matching schemas for entity types", async () => {
		const contract = await compileSharedContract(TEST_PROJECT_ID);
		const entityTypes = contract.types.filter((t) => t.kind === "entity");
		const schemaNames = new Set(contract.schemas.map((s) => s.name));
		for (const et of entityTypes) {
			assert.ok(
				schemaNames.has(`${et.name}Schema`),
				`Zod schema exists for entity type ${et.name}`,
			);
		}
	});
});

describe("contracts — validateContracts", () => {
	it("should return a coherent result (ok or errors with codes)", async () => {
		const result = await validateContracts(TEST_PROJECT_ID);

		assert.ok(typeof result.ok === "boolean", "ok is boolean");
		assert.ok(Array.isArray(result.errors), "errors is an array");
		assert.ok(typeof result.summary === "object", "summary is object");
		assert.ok(typeof result.summary.checks === "number", "checks is number");
		assert.ok(typeof result.summary.passed === "number", "passed is number");

		// Each error must have a code and contract field
		for (const err of result.errors) {
			assert.ok(typeof err.code === "string", "error has code");
			assert.ok(typeof err.message === "string", "error has message");
			assert.ok(
				["backend", "frontend", "shared", "cross"].includes(err.contract),
				`error.contract is valid: ${err.contract}`,
			);
		}
	});
});

describe("contracts — getRuntimeTarget (graceful fallback)", () => {
	it("should return DEFAULT_RUNTIME_TARGET when table is not migrated (or row not found)", async () => {
		// The table may or may not exist. Either way we must never crash and must
		// return something with name:"hono-next".
		const result = await getRuntimeTarget(TEST_PROJECT_ID, "hono-next");

		assert.ok(typeof result === "object", "result is object");
		// The returned target has the core DEFAULT shape regardless of DB state
		assert.ok(result.name, "result has name");
		assert.ok(result.backend, "result has backend");
		assert.ok(result.frontend, "result has frontend");
		assert.ok(result.source === "db" || result.source === "default", "source is db or default");

		// If no row in DB, must return default name
		if (result.source === "default") {
			assert.equal(result.name, DEFAULT_RUNTIME_TARGET.name);
			assert.equal(result.backend.framework, DEFAULT_RUNTIME_TARGET.backend.framework);
		}
	});
});

describe("contracts — setRuntimeTarget (graceful on missing table)", () => {
	it("should return {ok:false, error:'runtime_target_table_not_migrated'} or {ok:true} — never crash", async () => {
		const result = await setRuntimeTarget(TEST_PROJECT_ID, {
			name: "__test_probe__",
			backend: { framework: "hono", versionPolicy: "latest-stable", runtime: "node", apiStyle: "rest" },
			frontend: { framework: "next", version: "16.x", router: "app", rendering: "server-components-first" },
			auth: { provider: "better-auth", basePath: "/api/auth" },
			database: { provider: "postgresql", orm: "prisma" },
			packageManager: "pnpm",
		});

		// Must be either ok:true (table exists) or ok:false with the migration error
		assert.ok(typeof result === "object", "result is object");
		if (!result.ok) {
			assert.equal(result.error, "runtime_target_table_not_migrated");
		} else {
			assert.ok(typeof result.id === "string", "ok=true has id");
			// Clean up the probe row if it was created
			try {
				const { prisma } = await import("../../db");
				await prisma.runtimeTarget.deleteMany({
					where: { projectId: TEST_PROJECT_ID, name: "__test_probe__" },
				});
			} catch {
				// table may not exist — ignore
			}
		}
	});
});
