// Deterministic tests for delta-spec-validation, delta-spec-compile, delta-spec-explain.
// No DB required — pure transforms only.
// Run: node --import tsx/esm --test src/lib/delta-spec.test.ts

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateDeltaSpec } from "./delta-spec-validation";
import { compileProposalToDelta } from "./delta-spec-compile";
import { explainDeltaSpec } from "./delta-spec-explain";
import type { ProposalContents } from "./platform-proposal";

// ─── validateDeltaSpec ─────────────────────────────────────────────────────────

describe("validateDeltaSpec — structural (Zod)", () => {
	it("accepts an empty DeltaSpec {}", () => {
		const result = validateDeltaSpec({}, { existingEntityNames: new Set(), existingOperationNames: new Set() });
		assert.equal(result.ok, true);
		assert.equal(result.errors.length, 0);
	});

	it("accepts entities.create with valid item", () => {
		const result = validateDeltaSpec(
			{ entities: { create: [{ name: "Post" }] } },
			{ existingEntityNames: new Set(), existingOperationNames: new Set() },
		);
		assert.equal(result.ok, true);
	});

	it("rejects entities.create with empty name", () => {
		const result = validateDeltaSpec(
			{ entities: { create: [{ name: "" }] } },
			{ existingEntityNames: new Set(), existingOperationNames: new Set() },
		);
		assert.equal(result.ok, false);
		assert.ok(result.errors.some((e) => e.code === "zod_error"));
	});

	it("rejects unknown operation kind", () => {
		const result = validateDeltaSpec(
			{
				operations: {
					create: [
						{ name: "myOp", kind: "INVALID_KIND", inputSchema: {}, steps: [] },
					],
				},
			},
			{ existingEntityNames: new Set(), existingOperationNames: new Set() },
		);
		assert.equal(result.ok, false);
		assert.ok(result.errors.some((e) => e.code === "zod_error"));
	});
});

describe("validateDeltaSpec — cross-refs (entity)", () => {
	it("passes when attribute references entity in creates", () => {
		const result = validateDeltaSpec(
			{
				entities: { create: [{ name: "Post" }] },
				attributes: { create: [{ entityName: "Post", name: "title", type: "TEXT" }] },
			},
			{ existingEntityNames: new Set(), existingOperationNames: new Set() },
		);
		assert.equal(result.ok, true);
	});

	it("passes when attribute references existing entity in ctx", () => {
		const result = validateDeltaSpec(
			{
				attributes: { create: [{ entityName: "User", name: "email", type: "EMAIL" }] },
			},
			{ existingEntityNames: new Set(["User"]), existingOperationNames: new Set() },
		);
		assert.equal(result.ok, true);
	});

	it("fails when attribute references unknown entity", () => {
		const result = validateDeltaSpec(
			{
				attributes: { create: [{ entityName: "Ghost", name: "x", type: "TEXT" }] },
			},
			{ existingEntityNames: new Set(), existingOperationNames: new Set() },
		);
		assert.equal(result.ok, false);
		assert.ok(result.errors.some((e) => e.code === "unresolved_entity_ref" && e.path.includes("attributes")));
	});

	it("fails when relation fromEntityName is unknown", () => {
		const result = validateDeltaSpec(
			{
				entities: { create: [{ name: "Comment" }] },
				relations: {
					create: [
						{ fromEntityName: "Ghost", toEntityName: "Comment", name: "comments", kind: "ONE_TO_MANY" },
					],
				},
			},
			{ existingEntityNames: new Set(), existingOperationNames: new Set() },
		);
		assert.equal(result.ok, false);
		assert.ok(result.errors.some((e) => e.code === "unresolved_entity_ref"));
	});

	it("fails when policy references unknown entity", () => {
		const result = validateDeltaSpec(
			{
				policies: {
					create: [
						{ name: "OwnerOnly", scope: "ENTITY", entityName: "Nonexistent", effect: "ALLOW", rule: {} },
					],
				},
			},
			{ existingEntityNames: new Set(), existingOperationNames: new Set() },
		);
		assert.equal(result.ok, false);
		assert.ok(result.errors.some((e) => e.code === "unresolved_entity_ref"));
	});

	it("fails when trigger references unknown operation", () => {
		const result = validateDeltaSpec(
			{
				triggers: {
					create: [
						{ name: "t1", kind: "EVENT", source: {}, operationName: "noSuchOp" },
					],
				},
			},
			{ existingEntityNames: new Set(), existingOperationNames: new Set() },
		);
		assert.equal(result.ok, false);
		assert.ok(result.errors.some((e) => e.code === "unresolved_operation_ref"));
	});

	it("passes when trigger references operation created in same spec", () => {
		const result = validateDeltaSpec(
			{
				operations: {
					create: [{ name: "sendEmail", kind: "COMMAND", inputSchema: {}, steps: [] }],
				},
				triggers: {
					create: [{ name: "t1", kind: "EVENT", source: {}, operationName: "sendEmail" }],
				},
			},
			{ existingEntityNames: new Set(), existingOperationNames: new Set() },
		);
		assert.equal(result.ok, true);
	});
});

// ─── compileProposalToDelta ────────────────────────────────────────────────────

describe("compileProposalToDelta", () => {
	const minimalProposal: ProposalContents = {
		entities: [{ name: "Task" }],
		attributes: [
			{ entity: "Task", name: "title", type: "TEXT", required: true },
			{ entity: "Task", name: "done", type: "CHECKBOX" },
		],
	};

	it("produces entities.create with correct name", () => {
		const delta = compileProposalToDelta(minimalProposal);
		assert.equal(delta.entities?.create?.length, 1);
		assert.equal(delta.entities?.create?.[0]?.name, "Task");
	});

	it("produces attributes.create mapped from proposal attributes", () => {
		const delta = compileProposalToDelta(minimalProposal);
		assert.equal(delta.attributes?.create?.length, 2);
		const title = delta.attributes?.create?.find((a) => a.name === "title");
		assert.ok(title, "title attribute must be present");
		assert.equal(title!.entityName, "Task");
		assert.equal(title!.type, "TEXT");
		assert.equal(title!.required, true);
	});

	it("omits empty buckets (no resources → no resources key)", () => {
		const delta = compileProposalToDelta(minimalProposal);
		assert.equal(delta.resources, undefined);
		assert.equal(delta.operations, undefined);
		assert.equal(delta.relations, undefined);
	});

	it("maps relations correctly", () => {
		const proposal: ProposalContents = {
			entities: [{ name: "Post" }, { name: "Comment" }],
			relations: [
				{ from: "Post", to: "Comment", name: "comments", kind: "ONE_TO_MANY", fromField: "postId" },
			],
		};
		const delta = compileProposalToDelta(proposal);
		assert.equal(delta.relations?.create?.length, 1);
		const rel = delta.relations?.create?.[0];
		assert.equal(rel?.fromEntityName, "Post");
		assert.equal(rel?.toEntityName, "Comment");
		assert.equal(rel?.kind, "ONE_TO_MANY");
	});

	it("maps operations with all fields", () => {
		const proposal: ProposalContents = {
			operations: [
				{
					name: "createTask",
					kind: "COMMAND",
					inputSchema: { title: "string" },
					reads: [],
					writes: ["Task"],
					steps: [{ kind: "mutate", op: "create", entity: "Task" }],
					bodyHint: "create a new task",
				},
			],
		};
		const delta = compileProposalToDelta(proposal);
		const op = delta.operations?.create?.[0];
		assert.ok(op, "operation must be present");
		assert.equal(op!.name, "createTask");
		assert.equal(op!.kind, "COMMAND");
		assert.deepEqual(op!.writes, ["Task"]);
		assert.equal(op!.bodyHint, "create a new task");
	});

	it("maps policies with scope and rule", () => {
		const proposal: ProposalContents = {
			policies: [
				{
					name: "OwnerOnly",
					scope: "ENTITY",
					entity: "Task",
					effect: "ALLOW",
					rule: { eq: [{ ref: "$.auth.userId" }, { ref: "$.record.ownerId" }] },
				},
			],
		};
		const delta = compileProposalToDelta(proposal);
		const pol = delta.policies?.create?.[0];
		assert.ok(pol, "policy must be present");
		assert.equal(pol!.name, "OwnerOnly");
		assert.equal(pol!.entityName, "Task");
	});

	it("roundtrip: compileProposalToDelta output passes validateDeltaSpec", () => {
		const delta = compileProposalToDelta(minimalProposal);
		const result = validateDeltaSpec(delta, {
			existingEntityNames: new Set(),
			existingOperationNames: new Set(),
		});
		assert.equal(result.ok, true, `validation errors: ${JSON.stringify(result.errors)}`);
	});
});

// ─── explainDeltaSpec ─────────────────────────────────────────────────────────

describe("explainDeltaSpec", () => {
	it("returns a markdown string with # DeltaSpec header", () => {
		const delta = compileProposalToDelta({
			entities: [{ name: "Article" }],
			attributes: [{ entity: "Article", name: "title", type: "TEXT" }],
		});
		const md = explainDeltaSpec(delta);
		assert.ok(typeof md === "string");
		assert.ok(md.startsWith("# DeltaSpec"), "should start with # DeltaSpec header");
	});

	it("reports correct create counts for entities + attributes", () => {
		const delta = compileProposalToDelta({
			entities: [{ name: "Alpha" }, { name: "Beta" }],
			attributes: [{ entity: "Alpha", name: "x", type: "TEXT" }],
		});
		const md = explainDeltaSpec(delta);
		assert.ok(md.includes("2 create"), "should mention 2 creates for entities");
		assert.ok(md.includes("1 create"), "should mention 1 create for attributes");
	});

	it("returns empty-spec message for empty DeltaSpec", () => {
		const md = explainDeltaSpec({});
		assert.ok(md.includes("empty spec"), "should mention empty spec");
	});

	it("includes apply order section", () => {
		const delta = compileProposalToDelta({ entities: [{ name: "X" }] });
		const md = explainDeltaSpec(delta);
		assert.ok(md.includes("Apply order"), "should include Apply order section");
	});

	it("lists bucket names for non-empty buckets", () => {
		const delta = compileProposalToDelta({
			entities: [{ name: "Post" }],
			operations: [{ name: "listPost", kind: "QUERY", inputSchema: {}, steps: [] }],
		});
		const md = explainDeltaSpec(delta);
		assert.ok(md.includes("Entities"), "should include Entities bucket label");
		assert.ok(md.includes("Operations"), "should include Operations bucket label");
	});
});
