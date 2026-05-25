// Golden / contract tests for the compile pipeline.
// These are DETERMINISTIC — no DB, no LLM.
//
// Contract tests assert structural properties of the compiled DeltaSpec:
//   - required buckets present
//   - item counts match
//   - item names match
//   - assertDeltaSpecContract passes (Zod + cross-refs + semantic)
//
// Run: node --import tsx/esm --test src/test/golden/pipeline.golden.test.ts

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { compileProposalToDelta } from "../../lib/delta-spec-compile";
import { assertDeltaSpecContract } from "../../lib/contract/assertions";
import {
	todoProposal,
	todoGoldenContract,
	minimalProposal,
	minimalGoldenContract,
	minimalExpectedDelta,
} from "./fixtures";

const emptyCtx = { existingEntityNames: new Set<string>(), existingOperationNames: new Set<string>() };

// ─── Todo App golden contract ─────────────────────────────────────────────────

describe("compileProposalToDelta — todoProposal golden contract", () => {
	const delta = compileProposalToDelta(todoProposal);

	it("entities bucket: count and names match", () => {
		const creates = delta.entities?.create ?? [];
		assert.equal(creates.length, todoGoldenContract.entities.count);
		for (const name of todoGoldenContract.entities.names) {
			assert.ok(creates.some((e) => e.name === name), `entity "${name}" must be present`);
		}
	});

	it("attributes bucket: count and names match", () => {
		const creates = delta.attributes?.create ?? [];
		assert.equal(creates.length, todoGoldenContract.attributes.count);
		for (const name of todoGoldenContract.attributes.names) {
			assert.ok(creates.some((a) => a.name === name), `attribute "${name}" must be present`);
		}
	});

	it("relations bucket: count and names match", () => {
		const creates = delta.relations?.create ?? [];
		assert.equal(creates.length, todoGoldenContract.relations.count);
		for (const name of todoGoldenContract.relations.names) {
			assert.ok(creates.some((r) => r.name === name), `relation "${name}" must be present`);
		}
	});

	it("resources bucket: count and names match", () => {
		const creates = delta.resources?.create ?? [];
		assert.equal(creates.length, todoGoldenContract.resources.count);
		for (const name of todoGoldenContract.resources.names) {
			assert.ok(creates.some((r) => r.name === name), `resource "${name}" must be present`);
		}
	});

	it("operations bucket: count and names match", () => {
		const creates = delta.operations?.create ?? [];
		assert.equal(creates.length, todoGoldenContract.operations.count);
		for (const name of todoGoldenContract.operations.names) {
			assert.ok(creates.some((o) => o.name === name), `operation "${name}" must be present`);
		}
	});

	it("policies bucket: count and names match", () => {
		const creates = delta.policies?.create ?? [];
		assert.equal(creates.length, todoGoldenContract.policies.count);
		for (const name of todoGoldenContract.policies.names) {
			assert.ok(creates.some((p) => p.name === name), `policy "${name}" must be present`);
		}
	});

	it("passes assertDeltaSpecContract", () => {
		const r = assertDeltaSpecContract(delta, emptyCtx);
		assert.equal(r.ok, true, `contract violations: ${JSON.stringify(r.violations)}`);
	});

	it("createTodoItem operation maps writes correctly", () => {
		const op = delta.operations?.create?.find((o) => o.name === "createTodoItem");
		assert.ok(op, "createTodoItem must be present");
		assert.deepEqual(op!.writes, ["TodoItem"]);
	});

	it("TodoListOwner policy has entityName=TodoList", () => {
		const pol = delta.policies?.create?.find((p) => p.name === "TodoListOwner");
		assert.ok(pol, "TodoListOwner policy must be present");
		assert.equal(pol!.entityName, "TodoList");
		assert.equal(pol!.scope, "ENTITY");
		assert.equal(pol!.effect, "ALLOW");
	});

	it("relation 'items' has correct from/to and kind", () => {
		const rel = delta.relations?.create?.find((r) => r.name === "items");
		assert.ok(rel, "items relation must be present");
		assert.equal(rel!.fromEntityName, "TodoList");
		assert.equal(rel!.toEntityName, "TodoItem");
		assert.equal(rel!.kind, "ONE_TO_MANY");
	});
});

// ─── Minimal proposal golden contract ────────────────────────────────────────

describe("compileProposalToDelta — minimalProposal golden contract", () => {
	const delta = compileProposalToDelta(minimalProposal);

	it("entities bucket: count and names match", () => {
		const creates = delta.entities?.create ?? [];
		assert.equal(creates.length, minimalGoldenContract.entities.count);
		for (const name of minimalGoldenContract.entities.names) {
			assert.ok(creates.some((e) => e.name === name), `entity "${name}" must be present`);
		}
	});

	it("attributes bucket: count and names match", () => {
		const creates = delta.attributes?.create ?? [];
		assert.equal(creates.length, minimalGoldenContract.attributes.count);
		for (const name of minimalGoldenContract.attributes.names) {
			assert.ok(creates.some((a) => a.name === name), `attribute "${name}" must be present`);
		}
	});

	it("no extraneous buckets in empty proposal", () => {
		assert.equal(delta.operations, undefined);
		assert.equal(delta.policies, undefined);
		assert.equal(delta.relations, undefined);
		assert.equal(delta.resources, undefined);
	});

	it("passes assertDeltaSpecContract", () => {
		const r = assertDeltaSpecContract(delta, emptyCtx);
		assert.equal(r.ok, true, `contract violations: ${JSON.stringify(r.violations)}`);
	});

	it("slug attribute is unique", () => {
		const slug = delta.attributes?.create?.find((a) => a.name === "slug");
		assert.ok(slug, "slug attribute must be present");
		assert.equal(slug!.unique, true);
	});

	it("strict structure match for minimalProposal delta (entities block)", () => {
		assert.equal(delta.entities?.create?.length, minimalExpectedDelta.entities?.create?.length);
		assert.equal(delta.entities?.create?.[0]?.name, minimalExpectedDelta.entities?.create?.[0]?.name);
	});
});

// ─── compileProposalToDelta — idempotence ──────────────────────────────────────

describe("compileProposalToDelta — idempotence", () => {
	it("same input produces identical output on repeated calls", () => {
		const delta1 = compileProposalToDelta(minimalProposal);
		const delta2 = compileProposalToDelta(minimalProposal);
		assert.deepEqual(delta1, delta2, "compile must be deterministic");
	});
});

// ─── assertDeltaSpecContract — fixture-level contract pass ────────────────────

describe("assertDeltaSpecContract on golden fixtures", () => {
	it("todoProposal compiled delta passes contract", () => {
		const delta = compileProposalToDelta(todoProposal);
		const r = assertDeltaSpecContract(delta, emptyCtx);
		assert.equal(r.ok, true, `violations: ${JSON.stringify(r.violations)}`);
	});

	it("minimalProposal compiled delta passes contract", () => {
		const delta = compileProposalToDelta(minimalProposal);
		const r = assertDeltaSpecContract(delta, emptyCtx);
		assert.equal(r.ok, true, `violations: ${JSON.stringify(r.violations)}`);
	});
});
