// Tests for behavior-expand.ts (node:test)
// Run: pnpm --filter backend exec node --experimental-vm-modules --import tsx/esm \
//      src/lib/behavior-expand.test.ts
// Or via the workspace test runner.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { expandToDelta } from "./behavior-expand";
import { validateDeltaSpec } from "./delta-spec-validation";

// ─── Helper ───────────────────────────────────────────────────────────────────

function expandOne(entityName: string, behavior: string, config?: unknown) {
	return expandToDelta([
		{
			name: entityName,
			behaviors: [behavior as never],
			config: config ? ({ [behavior]: config } as never) : undefined,
		},
	]);
}

// ─── ownable ──────────────────────────────────────────────────────────────────

describe("expandToDelta — ownable", () => {
	it("produces ownerId attribute for Ticket", () => {
		const { deltaSpec, perBehavior } = expandOne("Ticket", "ownable");

		const attrs = deltaSpec.attributes?.create ?? [];
		const ownerAttr = attrs.find((a) => a.name === "ownerId");
		assert.ok(ownerAttr, "ownerId attribute must be present");
		assert.equal(ownerAttr.entityName, "Ticket");

		assert.equal(perBehavior.length, 1);
		assert.equal(perBehavior[0]!.behavior, "ownable");
		assert.equal(perBehavior[0]!.entity, "Ticket");
		assert.ok(perBehavior[0]!.added.attributes.some((a) => a.name === "ownerId"));
	});

	it("produces TicketOwnerOnly policy", () => {
		const { deltaSpec } = expandOne("Ticket", "ownable");

		const policies = deltaSpec.policies?.create ?? [];
		const ownerPolicy = policies.find((p) => p.name === "TicketOwnerOnly");
		assert.ok(ownerPolicy, "TicketOwnerOnly policy must be present");
		assert.equal(ownerPolicy.scope, "ENTITY");
		assert.equal(ownerPolicy.entityName, "Ticket");
		assert.equal(ownerPolicy.effect, "ALLOW");
	});

	it("produces operations including listTicketForOwner", () => {
		const { deltaSpec } = expandOne("Ticket", "ownable");

		const ops = deltaSpec.operations?.create ?? [];
		assert.ok(ops.some((o) => o.name === "listTicketForOwner"), "listTicketForOwner operation expected");
	});

	it("produces testScenarios", () => {
		const { deltaSpec } = expandOne("Ticket", "ownable");

		const ts = deltaSpec.testScenarios?.create ?? [];
		assert.ok(ts.length >= 2, "at least 2 test scenarios expected");
	});

	it("respects custom ownerField config", () => {
		const { deltaSpec } = expandOne("Invoice", "ownable", { ownerField: "createdBy" });

		const attrs = deltaSpec.attributes?.create ?? [];
		assert.ok(attrs.some((a) => a.name === "createdBy"), "custom ownerField createdBy expected");
	});

	it("passes validateDeltaSpec with Ticket as existing entity", () => {
		const { deltaSpec } = expandOne("Ticket", "ownable");

		const result = validateDeltaSpec(deltaSpec, {
			existingEntityNames: new Set(["Ticket"]),
			existingOperationNames: new Set(),
		});
		assert.equal(result.ok, true, `validation errors: ${JSON.stringify(result.errors)}`);
	});
});

// ─── soft-deletable ───────────────────────────────────────────────────────────

describe("expandToDelta — soft-deletable", () => {
	it("produces deletedAt attribute", () => {
		const { deltaSpec, perBehavior } = expandOne("Task", "soft-deletable");

		const attrs = deltaSpec.attributes?.create ?? [];
		assert.ok(attrs.some((a) => a.name === "deletedAt"), "deletedAt attribute expected");

		assert.equal(perBehavior[0]!.behavior, "soft-deletable");
		assert.ok(perBehavior[0]!.added.attributes.some((a) => a.name === "deletedAt"));
	});

	it("produces restoreTask operation", () => {
		const { deltaSpec } = expandOne("Task", "soft-deletable");

		const ops = deltaSpec.operations?.create ?? [];
		assert.ok(ops.some((o) => o.name === "restoreTask"), "restoreTask operation expected");
	});

	it("produces TaskNotDeleted policy", () => {
		const { deltaSpec } = expandOne("Task", "soft-deletable");

		const policies = deltaSpec.policies?.create ?? [];
		assert.ok(policies.some((p) => p.name === "TaskNotDeleted"), "TaskNotDeleted policy expected");
	});

	it("passes validateDeltaSpec", () => {
		const { deltaSpec } = expandOne("Task", "soft-deletable");

		const result = validateDeltaSpec(deltaSpec, {
			existingEntityNames: new Set(["Task"]),
			existingOperationNames: new Set(),
		});
		assert.equal(result.ok, true, `validation errors: ${JSON.stringify(result.errors)}`);
	});
});

// ─── commentable ──────────────────────────────────────────────────────────────

describe("expandToDelta — commentable", () => {
	it("produces Comment relation from Post", () => {
		const { deltaSpec, perBehavior } = expandOne("Post", "commentable");

		const relations = deltaSpec.relations?.create ?? [];
		const commentRelation = relations.find(
			(r) => r.fromEntityName === "Post" && r.toEntityName === "Comment",
		);
		assert.ok(commentRelation, "Comment relation from Post expected");
		assert.equal(commentRelation.kind, "ONE_TO_MANY");

		assert.ok(perBehavior[0]!.added.relations.length > 0, "perBehavior should report relations");
	});

	it("produces addCommentToPost and listPostComments operations", () => {
		const { deltaSpec } = expandOne("Post", "commentable");

		const ops = deltaSpec.operations?.create ?? [];
		assert.ok(ops.some((o) => o.name === "addCommentToPost"), "addCommentToPost expected");
		assert.ok(ops.some((o) => o.name === "listPostComments"), "listPostComments expected");
	});

	it("passes validateDeltaSpec with Post and Comment as existing", () => {
		const { deltaSpec } = expandOne("Post", "commentable");

		const result = validateDeltaSpec(deltaSpec, {
			existingEntityNames: new Set(["Post", "Comment"]),
			existingOperationNames: new Set(),
		});
		assert.equal(result.ok, true, `validation errors: ${JSON.stringify(result.errors)}`);
	});
});

// ─── publishable ──────────────────────────────────────────────────────────────

describe("expandToDelta — publishable", () => {
	it("produces status and publishedAt attributes", () => {
		const { deltaSpec } = expandOne("Article", "publishable");

		const attrs = deltaSpec.attributes?.create ?? [];
		assert.ok(attrs.some((a) => a.name === "status"), "status attribute expected");
		assert.ok(attrs.some((a) => a.name === "publishedAt"), "publishedAt attribute expected");
	});

	it("produces publish/unpublish/archive operations", () => {
		const { deltaSpec } = expandOne("Article", "publishable");

		const ops = deltaSpec.operations?.create ?? [];
		assert.ok(ops.some((o) => o.name === "publishArticle"), "publishArticle expected");
		assert.ok(ops.some((o) => o.name === "unpublishArticle"), "unpublishArticle expected");
		assert.ok(ops.some((o) => o.name === "archiveArticle"), "archiveArticle expected");
	});
});

// ─── attachable ───────────────────────────────────────────────────────────────

describe("expandToDelta — attachable", () => {
	it("produces Asset relation", () => {
		const { deltaSpec } = expandOne("Document", "attachable");

		const relations = deltaSpec.relations?.create ?? [];
		assert.ok(
			relations.some((r) => r.fromEntityName === "Document" && r.toEntityName === "Asset"),
			"Asset relation expected",
		);
	});

	it("produces attachFileToDocument and listDocumentAttachments operations", () => {
		const { deltaSpec } = expandOne("Document", "attachable");

		const ops = deltaSpec.operations?.create ?? [];
		assert.ok(ops.some((o) => o.name === "attachFileToDocument"), "attachFileToDocument expected");
		assert.ok(ops.some((o) => o.name === "listDocumentAttachments"), "listDocumentAttachments expected");
	});
});

// ─── localizable ──────────────────────────────────────────────────────────────

describe("expandToDelta — localizable", () => {
	it("produces *Key attributes for each translatable field", () => {
		const { deltaSpec } = expandOne("Product", "localizable", { fields: ["name", "description"] });

		const attrs = deltaSpec.attributes?.create ?? [];
		assert.ok(attrs.some((a) => a.name === "nameKey"), "nameKey attribute expected");
		assert.ok(attrs.some((a) => a.name === "descriptionKey"), "descriptionKey attribute expected");
	});

	it("each *Key attribute references TextKey", () => {
		const { deltaSpec } = expandOne("Product", "localizable", { fields: ["title"] });

		const attrs = deltaSpec.attributes?.create ?? [];
		const titleKey = attrs.find((a) => a.name === "titleKey");
		assert.ok(titleKey, "titleKey attribute expected");
		assert.ok(
			(titleKey.config as Record<string, unknown>)?.relation === "TextKey",
			"relation to TextKey expected",
		);
	});
});

// ─── Multiple behaviors on same entity ───────────────────────────────────────

describe("expandToDelta — multiple behaviors", () => {
	it("aggregates ownable + soft-deletable for Contact", () => {
		const { deltaSpec, perBehavior } = expandToDelta([
			{ name: "Contact", behaviors: ["ownable", "soft-deletable"] },
		]);

		const attrs = deltaSpec.attributes?.create ?? [];
		assert.ok(attrs.some((a) => a.name === "ownerId"), "ownerId expected");
		assert.ok(attrs.some((a) => a.name === "deletedAt"), "deletedAt expected");

		assert.ok(attrs.length >= 2, "at least 2 attributes");
		assert.ok(
			(deltaSpec.policies?.create?.length ?? 0) >= 1,
			"at least 1 policy expected",
		);
		assert.equal(perBehavior.length, 2, "perBehavior must have 2 entries");
		assert.equal(perBehavior[0]!.entity, "Contact");
		assert.equal(perBehavior[1]!.entity, "Contact");
	});
});

// ─── searchable ───────────────────────────────────────────────────────────────

describe("expandToDelta — searchable", () => {
	it("produces searchTicket operation with q input", () => {
		const { deltaSpec } = expandOne("Ticket", "searchable", { fields: ["title", "body"] });

		const ops = deltaSpec.operations?.create ?? [];
		const searchOp = ops.find((o) => o.name === "searchTicket");
		assert.ok(searchOp, "searchTicket operation expected");
		assert.ok(
			Object.hasOwn(searchOp.inputSchema, "q"),
			"inputSchema must include q",
		);
	});
});
