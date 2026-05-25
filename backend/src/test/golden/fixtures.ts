// Golden test fixtures — minimal, representative ProposalContents and the
// DeltaSpec that compileProposalToDelta is expected to produce.
//
// These are pure data (no DB, no LLM). The golden DeltaSpec is derived from
// the compile function itself on first run, then locked as contract.

import type { ProposalContents } from "../../lib/platform-proposal";
import type { DeltaSpec } from "../../lib/dsl/delta-spec";

// ─── Fixture: Todo App proposal ───────────────────────────────────────────────

export const todoProposal: ProposalContents = {
	entities: [
		{ name: "TodoList", description: "A list of todos" },
		{ name: "TodoItem", description: "A single todo item" },
	],
	attributes: [
		{ entity: "TodoList", name: "title", type: "TEXT", required: true },
		{ entity: "TodoItem", name: "text", type: "TEXT", required: true },
		{ entity: "TodoItem", name: "done", type: "CHECKBOX", required: false },
	],
	relations: [
		{ from: "TodoList", to: "TodoItem", name: "items", kind: "ONE_TO_MANY", fromField: "listId" },
	],
	resources: [
		{ entity: "TodoList", name: "todoLists", exposedOps: ["list", "read", "create", "update", "delete"] },
		{ entity: "TodoItem", name: "todoItems", exposedOps: ["list", "create", "update", "delete"] },
	],
	operations: [
		{
			name: "createTodoItem",
			kind: "COMMAND",
			inputSchema: { type: "object", properties: { listId: { type: "string" }, text: { type: "string" } }, required: ["listId", "text"] },
			writes: ["TodoItem"],
			steps: [
				{ kind: "mutate", op: "create", entity: "TodoItem", data: { obj: { text: { ref: "$.input.text" }, done: { lit: false } } } },
				{ kind: "return", value: { lit: null } },
			],
		},
	],
	policies: [
		{
			name: "TodoListOwner",
			scope: "ENTITY",
			entity: "TodoList",
			effect: "ALLOW",
			rule: { eq: [{ ref: "$.auth.userId" }, { ref: "$.record.ownerId" }] },
		},
	],
};

// ─── Golden DeltaSpec contract (structure, not equality) ──────────────────────
//
// We don't assert exact deep-equality because the compile function may evolve.
// Instead, golden tests assert STRUCTURAL CONTRACTS:
//   - required buckets are present
//   - counts match
//   - names match

export const todoGoldenContract = {
	entities: { count: 2, names: ["TodoList", "TodoItem"] },
	attributes: { count: 3, names: ["title", "text", "done"] },
	relations: { count: 1, names: ["items"] },
	resources: { count: 2, names: ["todoLists", "todoItems"] },
	operations: { count: 1, names: ["createTodoItem"] },
	policies: { count: 1, names: ["TodoListOwner"] },
} as const;

// ─── Fixture: Minimal ProductSpec (just entities, for contract check) ─────────

export const minimalProposal: ProposalContents = {
	entities: [{ name: "Article" }],
	attributes: [
		{ entity: "Article", name: "slug", type: "TEXT", required: true, unique: true },
		{ entity: "Article", name: "body", type: "TEXTAREA", required: true },
	],
};

export const minimalGoldenContract = {
	entities: { count: 1, names: ["Article"] },
	attributes: { count: 2, names: ["slug", "body"] },
} as const;

// ─── Expected DeltaSpec shape for minimalProposal (strict) ────────────────────

export const minimalExpectedDelta: DeltaSpec = {
	entities: { create: [{ name: "Article", nameKey: undefined }] },
	attributes: {
		create: [
			{ entityName: "Article", name: "slug", type: "TEXT", required: true, unique: true, config: undefined },
			{ entityName: "Article", name: "body", type: "TEXTAREA", required: true, unique: undefined, config: undefined },
		],
	},
};
