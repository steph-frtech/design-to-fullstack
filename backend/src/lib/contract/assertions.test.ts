// Tests for contract assertion helpers.
// No DB required — assertCoverageContract is excluded (requires DB, tested in E2E).
// Run: node --import tsx/esm --test src/lib/contract/assertions.test.ts

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertDeltaSpecContract } from "./assertions";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const emptyCtx = { existingEntityNames: new Set<string>(), existingOperationNames: new Set<string>() };
const ctxWithUser = { existingEntityNames: new Set(["User"]), existingOperationNames: new Set<string>() };

// ─── assertDeltaSpecContract ──────────────────────────────────────────────────

describe("assertDeltaSpecContract — valid inputs", () => {
	it("accepts empty spec {}", () => {
		const r = assertDeltaSpecContract({}, emptyCtx);
		assert.equal(r.ok, true);
		assert.equal(r.violations.length, 0);
	});

	it("accepts valid entities + attributes", () => {
		const r = assertDeltaSpecContract(
			{
				entities: { create: [{ name: "Post" }] },
				attributes: { create: [{ entityName: "Post", name: "title", type: "TEXT" }] },
			},
			emptyCtx,
		);
		assert.equal(r.ok, true, `violations: ${JSON.stringify(r.violations)}`);
	});

	it("accepts QUERY operation with return step", () => {
		const r = assertDeltaSpecContract(
			{
				entities: { create: [{ name: "Item" }] },
				operations: {
					create: [
						{
							name: "listItems",
							kind: "QUERY",
							inputSchema: {},
							steps: [{ kind: "return", value: { lit: [] } }],
						},
					],
				},
			},
			emptyCtx,
		);
		assert.equal(r.ok, true, `violations: ${JSON.stringify(r.violations)}`);
	});

	it("accepts COMMAND operation without return step", () => {
		const r = assertDeltaSpecContract(
			{
				operations: {
					create: [
						{
							name: "doThing",
							kind: "COMMAND",
							inputSchema: {},
							steps: [{ kind: "mutate", op: "create", entity: "X", data: { lit: null } }],
						},
					],
				},
			},
			emptyCtx,
		);
		// no missing_return violation for COMMAND
		const hasReturn = r.violations.some((v) => v.code === "missing_return");
		assert.equal(hasReturn, false, "COMMAND should not require return step");
	});

	it("accepts ENTITY policy with entityName set", () => {
		const r = assertDeltaSpecContract(
			{
				entities: { create: [{ name: "Task" }] },
				policies: {
					create: [{ name: "TaskOwner", scope: "ENTITY", entityName: "Task", effect: "ALLOW", rule: {} }],
				},
			},
			emptyCtx,
		);
		assert.equal(r.ok, true, `violations: ${JSON.stringify(r.violations)}`);
	});
});

describe("assertDeltaSpecContract — violations", () => {
	it("rejects non-object input (string)", () => {
		const r = assertDeltaSpecContract("not-an-object", emptyCtx);
		assert.equal(r.ok, false);
		assert.ok(r.violations.some((v) => v.code === "invalid_json_structure"));
	});

	it("rejects null input", () => {
		const r = assertDeltaSpecContract(null, emptyCtx);
		assert.equal(r.ok, false);
		assert.ok(r.violations.some((v) => v.code === "invalid_json_structure"));
	});

	it("reports unresolved entity ref when attribute refs unknown entity", () => {
		const r = assertDeltaSpecContract(
			{
				attributes: { create: [{ entityName: "Ghost", name: "x", type: "TEXT" }] },
			},
			emptyCtx,
		);
		assert.equal(r.ok, false);
		assert.ok(r.violations.some((v) => v.code === "unresolved_entity_ref"));
	});

	it("reports orphan_policy when ENTITY policy has no entityName/entityId", () => {
		const r = assertDeltaSpecContract(
			{
				policies: {
					create: [{ name: "Orphan", scope: "ENTITY", effect: "ALLOW", rule: {} }],
				},
			},
			emptyCtx,
		);
		assert.equal(r.ok, false);
		assert.ok(r.violations.some((v) => v.code === "orphan_policy"), JSON.stringify(r.violations));
	});

	it("reports missing_return for QUERY operation without return step", () => {
		const r = assertDeltaSpecContract(
			{
				operations: {
					create: [
						{
							name: "getUser",
							kind: "QUERY",
							inputSchema: {},
							steps: [{ kind: "log", level: "info", message: { lit: "hi" } }],
						},
					],
				},
			},
			emptyCtx,
		);
		assert.equal(r.ok, false);
		assert.ok(r.violations.some((v) => v.code === "missing_return"), JSON.stringify(r.violations));
	});

	it("reports unknown_expr_function for Expr with unknown call", () => {
		const r = assertDeltaSpecContract(
			{
				operations: {
					create: [
						{
							name: "op1",
							kind: "COMMAND",
							inputSchema: {},
							steps: [
								{
									kind: "return",
									value: { call: "unknownFn123", args: [{ lit: "x" }] },
								},
							],
						},
					],
				},
			},
			emptyCtx,
		);
		// unknown_expr_function is reported
		assert.ok(r.violations.some((v) => v.code === "unknown_expr_function"), JSON.stringify(r.violations));
	});

	it("reports zod_error for invalid operation kind", () => {
		const r = assertDeltaSpecContract(
			{
				operations: {
					create: [{ name: "x", kind: "BAD_KIND", inputSchema: {}, steps: [] }],
				},
			},
			emptyCtx,
		);
		assert.equal(r.ok, false);
		assert.ok(r.violations.some((v) => v.code === "zod_error"));
	});

	it("accumulates multiple violations", () => {
		const r = assertDeltaSpecContract(
			{
				// orphan policy + missing_return
				policies: { create: [{ name: "Orphan", scope: "ENTITY", effect: "ALLOW", rule: {} }] },
				operations: { create: [{ name: "q", kind: "QUERY", inputSchema: {}, steps: [] }] },
			},
			emptyCtx,
		);
		assert.equal(r.ok, false);
		assert.ok(r.violations.length >= 2, `expected >=2 violations, got ${r.violations.length}: ${JSON.stringify(r.violations)}`);
	});
});
