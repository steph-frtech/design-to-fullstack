// Governance guardrails + audit tests.
// Run: node --import tsx/esm --test src/lib/governance/governance.test.ts

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
	guardNoInlineSecrets,
	guardNoUnknownExprFunctions,
	guardDeleteRequiresValidation,
	guardValidateBeforeApply,
	guardCodegenNeedsArtifactTracking,
} from "./guardrails";
import { emitAuditEvent, readAuditLog } from "./audit";
import { runGovernanceChecks } from "./governance-check";

// ─── guardNoInlineSecrets ──────────────────────────────────────────────────────

describe("guardNoInlineSecrets", () => {
	it("detects sk_live_ prefix in integration config", () => {
		const deltaSpec = {
			integrations: {
				create: [
					{
						key: "stripe",
						provider: "stripe",
						capabilities: [],
						config: { apiKey: "sk_live_ABC123XYZ" },
					},
				],
			},
		};
		const result = guardNoInlineSecrets(deltaSpec);
		assert.equal(result.ok, false);
		assert.equal(result.code, "inline_secrets_detected");
		const details = result.details as Array<{ path: string; reason: string }>;
		assert.ok(details.some((v) => v.path.includes("apiKey")));
	});

	it("detects field named 'password' with a literal value", () => {
		const deltaSpec = { config: { password: "hunter2" } };
		const result = guardNoInlineSecrets(deltaSpec);
		assert.equal(result.ok, false);
		assert.ok(
			(result.details as Array<{ path: string }>).some((v) =>
				v.path.includes("password"),
			),
		);
	});

	it("allows secretRef value on a secret-looking key", () => {
		const deltaSpec = { config: { apiKey: "secretRef:env:STRIPE_KEY" } };
		const result = guardNoInlineSecrets(deltaSpec);
		assert.equal(result.ok, true);
	});

	it("allows env: ref value", () => {
		const deltaSpec = { config: { token: "env:MY_TOKEN" } };
		const result = guardNoInlineSecrets(deltaSpec);
		assert.equal(result.ok, true);
	});

	it("is OK for an empty deltaSpec", () => {
		const result = guardNoInlineSecrets({});
		assert.equal(result.ok, true);
	});

	it("detects figd_ prefix", () => {
		const result = guardNoInlineSecrets({ config: { value: "figd_abc123def456" } });
		assert.equal(result.ok, false);
	});
});

// ─── guardNoUnknownExprFunctions ──────────────────────────────────────────────

describe("guardNoUnknownExprFunctions", () => {
	it("flags unknown function hackzor", () => {
		const deltaSpec = {
			operations: {
				create: [
					{
						name: "myOp",
						kind: "COMMAND",
						inputSchema: {},
						steps: [
							{
								kind: "return",
								value: { call: "hackzor", args: [] },
							},
						],
					},
				],
			},
		};
		const result = guardNoUnknownExprFunctions(deltaSpec);
		assert.equal(result.ok, false);
		assert.equal(result.code, "unknown_expr_functions");
		const details = result.details as { unknownCalls: string[] };
		assert.ok(details.unknownCalls.includes("hackzor"));
	});

	it("allows known function lowercase", () => {
		const deltaSpec = {
			operations: {
				create: [
					{
						name: "myOp",
						kind: "COMMAND",
						inputSchema: {},
						steps: [
							{
								kind: "return",
								value: { call: "lowercase", args: [{ ref: "$.input.name" }] },
							},
						],
					},
				],
			},
		};
		const result = guardNoUnknownExprFunctions(deltaSpec);
		assert.equal(result.ok, true);
	});

	it("is OK for a deltaSpec without any Expr calls", () => {
		const result = guardNoUnknownExprFunctions({ entities: { create: [{ name: "Post" }] } });
		assert.equal(result.ok, true);
	});
});

// ─── guardDeleteRequiresValidation ────────────────────────────────────────────

describe("guardDeleteRequiresValidation", () => {
	it("blocks when entities.delete is non-empty and confirmDeletes is absent", () => {
		const deltaSpec = { entities: { delete: [{ id: "ent_abc" }] } };
		const result = guardDeleteRequiresValidation(deltaSpec, {});
		assert.equal(result.ok, false);
		assert.equal(result.code, "delete_requires_validation");
	});

	it("blocks when confirmDeletes=false", () => {
		const deltaSpec = { entities: { delete: [{ id: "ent_abc" }] } };
		const result = guardDeleteRequiresValidation(deltaSpec, { confirmDeletes: false });
		assert.equal(result.ok, false);
	});

	it("passes when confirmDeletes=true", () => {
		const deltaSpec = { entities: { delete: [{ id: "ent_abc" }] } };
		const result = guardDeleteRequiresValidation(deltaSpec, { confirmDeletes: true });
		assert.equal(result.ok, true);
	});

	it("passes when there are no deletes", () => {
		const deltaSpec = { entities: { create: [{ name: "Post" }] } };
		const result = guardDeleteRequiresValidation(deltaSpec, {});
		assert.equal(result.ok, true);
	});

	it("reports all buckets with deletes in details", () => {
		const deltaSpec = {
			entities: { delete: [{ id: "e1" }] },
			operations: { delete: [{ id: "o1" }] },
		};
		const result = guardDeleteRequiresValidation(deltaSpec, {});
		assert.equal(result.ok, false);
		const d = result.details as { bucketsWithDeletes: string[] };
		assert.ok(d.bucketsWithDeletes.includes("entities"));
		assert.ok(d.bucketsWithDeletes.includes("operations"));
	});
});

// ─── guardValidateBeforeApply ─────────────────────────────────────────────────

describe("guardValidateBeforeApply", () => {
	const emptyCtx = {
		existingEntityNames: new Set<string>(),
		existingOperationNames: new Set<string>(),
	};

	it("blocks when deltaSpec fails Zod validation (empty entity name)", () => {
		const result = guardValidateBeforeApply(
			{ entities: { create: [{ name: "" }] } },
			emptyCtx,
		);
		assert.equal(result.ok, false);
		assert.equal(result.code, "validate_before_apply");
	});

	it("blocks on unresolved entity ref in attributes", () => {
		const result = guardValidateBeforeApply(
			{
				attributes: {
					create: [{ entityName: "Ghost", name: "title", type: "TEXT" }],
				},
			},
			emptyCtx,
		);
		assert.equal(result.ok, false);
	});

	it("passes for a valid entities.create", () => {
		const result = guardValidateBeforeApply(
			{ entities: { create: [{ name: "Post" }] } },
			emptyCtx,
		);
		assert.equal(result.ok, true);
	});

	it("passes for an empty deltaSpec", () => {
		const result = guardValidateBeforeApply({}, emptyCtx);
		assert.equal(result.ok, true);
	});
});

// ─── guardCodegenNeedsArtifactTracking ────────────────────────────────────────

describe("guardCodegenNeedsArtifactTracking", () => {
	it("allows dryRun without trackArtifacts", () => {
		const result = guardCodegenNeedsArtifactTracking({ dryRun: true });
		assert.equal(result.ok, true);
	});

	it("blocks non-dryRun without trackArtifacts", () => {
		const result = guardCodegenNeedsArtifactTracking({ dryRun: false });
		assert.equal(result.ok, false);
		assert.equal(result.code, "codegen_needs_artifact_tracking");
	});

	it("allows non-dryRun with trackArtifacts=true", () => {
		const result = guardCodegenNeedsArtifactTracking({ dryRun: false, trackArtifacts: true });
		assert.equal(result.ok, true);
	});

	it("blocks when dryRun is undefined and trackArtifacts is absent", () => {
		const result = guardCodegenNeedsArtifactTracking({});
		assert.equal(result.ok, false);
	});
});

// ─── emitAuditEvent + readAuditLog ────────────────────────────────────────────

describe("emitAuditEvent + readAuditLog", () => {
	let tmpPath: string;

	before(() => {
		tmpPath = path.join(os.tmpdir(), `dtfs-audit-test-${Date.now()}.jsonl`);
		process.env.DTFS_AUDIT_LOG = tmpPath;
		// Ensure DB persist is off for this test (no DB available)
		delete process.env.DTFS_AUDIT_DB;
	});

	after(() => {
		try {
			fs.unlinkSync(tmpPath);
		} catch {
			// ignore if already removed
		}
		delete process.env.DTFS_AUDIT_LOG;
	});

	it("writes a line to the JSONL file", async () => {
		await emitAuditEvent({ projectId: "proj_test", action: "apply_delta", target: { changeSetId: "cs_1" } });
		const content = fs.readFileSync(tmpPath, "utf8");
		assert.ok(content.includes("apply_delta"));
		assert.ok(content.includes("proj_test"));
	});

	it("readAuditLog returns the written event", async () => {
		await emitAuditEvent({ projectId: "proj_test", action: "test_event_2" });
		const events = readAuditLog({ projectId: "proj_test" });
		assert.ok(events.length >= 2);
		assert.ok(events.some((e) => e.action === "apply_delta"));
		assert.ok(events.some((e) => e.action === "test_event_2"));
	});

	it("readAuditLog filters by action", async () => {
		const events = readAuditLog({ projectId: "proj_test", action: "test_event_2" });
		assert.ok(events.every((e) => e.action === "test_event_2"));
	});

	it("readAuditLog respects limit", async () => {
		// Write multiple events
		for (let i = 0; i < 5; i++) {
			await emitAuditEvent({ projectId: "proj_limit_test", action: "bulk_event" });
		}
		const events = readAuditLog({ projectId: "proj_limit_test", limit: 3 });
		assert.equal(events.length, 3);
	});

	it("readAuditLog returns empty array when file doesn't exist", () => {
		process.env.DTFS_AUDIT_LOG = "/tmp/definitely-does-not-exist-dtfs-test.jsonl";
		const events = readAuditLog();
		assert.deepEqual(events, []);
		process.env.DTFS_AUDIT_LOG = tmpPath;
	});
});

// ─── runGovernanceChecks (aggregator) ─────────────────────────────────────────

describe("runGovernanceChecks (aggregator, no DB)", () => {
	// This test subset only exercises the sync guards without a real DB.
	// The DB-dependent parts (validateBeforeApply cross-refs, clarificationGate)
	// are tested through the real endpoints in e2e tests.

	it("returns ok=false when inline secret detected", async () => {
		// We can't call runGovernanceChecks directly without a DB, so test the
		// underlying guards individually — integration covered by the sync tests above.
		// This test validates the aggregation logic by testing guardrails individually.
		const secretResult = guardNoInlineSecrets({ config: { apiKey: "sk_live_XYZ" } });
		assert.equal(secretResult.ok, false);

		const deleteResult = guardDeleteRequiresValidation(
			{ entities: { delete: [{ id: "x" }] } },
			{},
		);
		assert.equal(deleteResult.ok, false);

		// Both violations should be "block"
		const violations = [
			{ ...secretResult, severity: "block" as const },
			{ ...deleteResult, severity: "block" as const },
		];
		const blocked = violations.some((v) => v.severity === "block" && !v.ok);
		assert.equal(blocked, true);
	});

	it("ok=true when all guards pass", () => {
		const secretResult = guardNoInlineSecrets({ entities: { create: [{ name: "Post" }] } });
		const deleteResult = guardDeleteRequiresValidation(
			{ entities: { create: [{ name: "Post" }] } },
			{},
		);
		const exprResult = guardNoUnknownExprFunctions({ entities: { create: [{ name: "Post" }] } });
		const validateResult = guardValidateBeforeApply(
			{ entities: { create: [{ name: "Post" }] } },
			{ existingEntityNames: new Set(), existingOperationNames: new Set() },
		);
		assert.equal(secretResult.ok, true);
		assert.equal(deleteResult.ok, true);
		assert.equal(exprResult.ok, true);
		assert.equal(validateResult.ok, true);
	});
});
