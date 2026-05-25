// Tests for Operation DSL + Policy DSL (step 9).
// Run with: pnpm exec tsx --test src/lib/dsl/operation-dsl.test.ts

import assert from "node:assert/strict";
import { test, describe } from "node:test";

import { operationBodySchema, operationStepSchema } from "./operation-dsl";
import { policyRuleSchema } from "./policy-dsl";
import { validateOperationBody, type OperationValidateCtx } from "./operation-validate";
import { validatePolicyRule } from "./policy-validate";
import { evalPolicyRule } from "./policy-eval";
import {
	collectOperationEntities,
	collectOperationPolicies,
	collectOperationIntegrations,
	collectOperationEvents,
	collectOperationReads,
	collectOperationWrites,
} from "./operation-analyze";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const baseCtx: OperationValidateCtx = {
	entityNames: ["User", "TodoList"],
	policyNames: ["owner-only"],
	integrationNames: ["email"],
	eventNames: ["list.created"],
};

// ─── OperationStep — Zod parse ────────────────────────────────────────────────

describe("operationStepSchema — valid steps", () => {
	test("parses a return step", () => {
		const result = operationStepSchema.safeParse({ kind: "return", value: { lit: 42 } });
		assert.equal(result.success, true);
	});

	test("parses a read step", () => {
		const result = operationStepSchema.safeParse({
			kind: "read",
			entity: "User",
			as: "u",
		});
		assert.equal(result.success, true);
	});

	test("parses a mutate step", () => {
		const result = operationStepSchema.safeParse({
			kind: "mutate",
			op: "create",
			entity: "TodoList",
			data: { obj: { title: { ref: "$.input.title" } } },
		});
		assert.equal(result.success, true);
	});

	test("parses an authorize step", () => {
		const result = operationStepSchema.safeParse({
			kind: "authorize",
			policy: "owner-only",
		});
		assert.equal(result.success, true);
	});

	test("parses a branch step (recursive)", () => {
		const result = operationStepSchema.safeParse({
			kind: "branch",
			if: { ref: "$.input.flag" },
			then: [{ kind: "return", value: { lit: true } }],
			else: [{ kind: "return", value: { lit: false } }],
		});
		assert.equal(result.success, true);
	});

	test("parses a log step", () => {
		const result = operationStepSchema.safeParse({
			kind: "log",
			level: "info",
			message: { lit: "hello" },
		});
		assert.equal(result.success, true);
	});

	test("parses an assert step", () => {
		const result = operationStepSchema.safeParse({
			kind: "assert",
			condition: { lit: true },
			message: "must be true",
		});
		assert.equal(result.success, true);
	});

	test("parses an emitEvent step", () => {
		const result = operationStepSchema.safeParse({
			kind: "emitEvent",
			event: "list.created",
			payload: { obj: { id: { ref: "$.list.id" } } },
		});
		assert.equal(result.success, true);
	});

	test("parses a callIntegration step", () => {
		const result = operationStepSchema.safeParse({
			kind: "callIntegration",
			integration: "email",
			capability: "send",
			input: { obj: { to: { ref: "$.input.email" } } },
			as: "emailResult",
		});
		assert.equal(result.success, true);
	});

	test("parses a validate step", () => {
		const result = operationStepSchema.safeParse({
			kind: "validate",
			schema: { type: "object", properties: { title: { type: "string" } } },
		});
		assert.equal(result.success, true);
	});
});

describe("operationStepSchema — invalid steps", () => {
	test("rejects unknown kind", () => {
		const result = operationStepSchema.safeParse({ kind: "unknown" });
		assert.equal(result.success, false);
	});

	test("rejects read step missing as", () => {
		const result = operationStepSchema.safeParse({ kind: "read", entity: "User" });
		assert.equal(result.success, false);
	});

	test("rejects mutate step with bad op", () => {
		const result = operationStepSchema.safeParse({
			kind: "mutate",
			op: "upsert",
			entity: "User",
		});
		assert.equal(result.success, false);
	});
});

// ─── validateOperationBody — semantic ────────────────────────────────────────

describe("validateOperationBody — semantic checks", () => {
	test("valid body returns ok:true", () => {
		const body = [{ kind: "return", value: { lit: 42 } }];
		const result = validateOperationBody(body, baseCtx);
		assert.equal(result.ok, true);
		assert.equal(result.errors.length, 0);
	});

	test("unknown entity in read step produces error", () => {
		const body = [{ kind: "read", entity: "NonExistent", as: "x" }];
		const result = validateOperationBody(body, baseCtx);
		assert.equal(result.ok, false);
		assert.ok(result.errors.some((e) => e.code === "unknown_entity"));
	});

	test("unknown entity in mutate step produces error", () => {
		const body = [{ kind: "mutate", op: "create", entity: "Nope", data: { lit: null } }];
		const result = validateOperationBody(body, baseCtx);
		assert.equal(result.ok, false);
		assert.ok(result.errors.some((e) => e.code === "unknown_entity"));
	});

	test("unknown policy in authorize step produces error", () => {
		const body = [{ kind: "authorize", policy: "no-such-policy" }];
		const result = validateOperationBody(body, baseCtx);
		assert.equal(result.ok, false);
		assert.ok(result.errors.some((e) => e.code === "unknown_policy"));
	});

	test("unknown integration in callIntegration step produces error", () => {
		const body = [
			{
				kind: "callIntegration",
				integration: "sms",
				capability: "send",
				input: { lit: null },
			},
		];
		const result = validateOperationBody(body, baseCtx);
		assert.equal(result.ok, false);
		assert.ok(result.errors.some((e) => e.code === "unknown_integration"));
	});

	test("Expr ref to unknown root produces error", () => {
		const body = [{ kind: "return", value: { ref: "$.ghost.id" } }];
		const result = validateOperationBody(body, baseCtx);
		assert.equal(result.ok, false);
		assert.ok(result.errors.some((e) => e.code === "ref_unknown_root"));
	});

	test("alias from read step is visible in subsequent step", () => {
		const body = [
			{ kind: "read", entity: "User", as: "u" },
			{ kind: "return", value: { ref: "$.u.email" } },
		];
		const result = validateOperationBody(body, baseCtx);
		assert.equal(result.ok, true, JSON.stringify(result.errors));
	});

	test("alias NOT yet defined produces error", () => {
		const body = [
			// u is defined AFTER we try to use it — should fail
			{ kind: "return", value: { ref: "$.u.email" } },
			{ kind: "read", entity: "User", as: "u" },
		];
		const result = validateOperationBody(body, baseCtx);
		assert.equal(result.ok, false);
		assert.ok(result.errors.some((e) => e.code === "ref_unknown_root"));
	});

	test("valid body with branch step passes", () => {
		const body = [
			{ kind: "read", entity: "User", as: "u" },
			{
				kind: "branch",
				if: { ref: "$.input.flag" },
				then: [{ kind: "return", value: { ref: "$.u.id" } }],
				else: [{ kind: "return", value: { lit: null } }],
			},
		];
		const result = validateOperationBody(body, baseCtx);
		assert.equal(result.ok, true, JSON.stringify(result.errors));
	});

	test("event name validation — unknown event errors when eventNames provided", () => {
		const body = [
			{ kind: "emitEvent", event: "no.such.event", payload: { lit: null } },
		];
		const result = validateOperationBody(body, baseCtx);
		assert.equal(result.ok, false);
		assert.ok(result.errors.some((e) => e.code === "unknown_event"));
	});

	test("event name validation — passes when eventNames not provided", () => {
		const body = [
			{ kind: "emitEvent", event: "any.event", payload: { lit: null } },
		];
		const { eventNames: _, ...ctxNoEvents } = baseCtx;
		const result = validateOperationBody(body, ctxNoEvents);
		assert.equal(result.ok, true, JSON.stringify(result.errors));
	});

	// ─── Required criteria cases ───────────────────────────────────────────────

	test("mutate create without data → fail (missing_field)", () => {
		const body = [{ kind: "mutate", op: "create", entity: "User" }];
		const result = validateOperationBody(body, baseCtx);
		assert.equal(result.ok, false);
		assert.ok(result.errors.some((e) => e.code === "missing_field"), JSON.stringify(result.errors));
	});

	test("mutate update without where → fail (missing_field)", () => {
		const body = [{ kind: "mutate", op: "update", entity: "User", data: { lit: null } }];
		const result = validateOperationBody(body, baseCtx);
		assert.equal(result.ok, false);
		assert.ok(result.errors.some((e) => e.code === "missing_field"), JSON.stringify(result.errors));
	});

	test("mutate delete without where → fail (missing_field)", () => {
		const body = [{ kind: "mutate", op: "delete", entity: "User" }];
		const result = validateOperationBody(body, baseCtx);
		assert.equal(result.ok, false);
		assert.ok(result.errors.some((e) => e.code === "missing_field"), JSON.stringify(result.errors));
	});

	test("as identifier invalid → fail (invalid_alias)", () => {
		const body = [{ kind: "read", entity: "User", as: "BadAlias" }];
		const result = validateOperationBody(body, baseCtx);
		assert.equal(result.ok, false);
		assert.ok(result.errors.some((e) => e.code === "invalid_alias"), JSON.stringify(result.errors));
	});

	test("as identifier with leading digit → fail (invalid_alias)", () => {
		const body = [{ kind: "read", entity: "User", as: "1user" }];
		const result = validateOperationBody(body, baseCtx);
		assert.equal(result.ok, false);
		assert.ok(result.errors.some((e) => e.code === "invalid_alias"), JSON.stringify(result.errors));
	});

	test("expectedReturn=true without return step → fail", () => {
		const body = [{ kind: "log", level: "info", message: { lit: "hi" } }];
		const result = validateOperationBody(body, { ...baseCtx, expectedReturn: true });
		assert.equal(result.ok, false);
		assert.ok(result.errors.some((e) => e.code === "missing_return"), JSON.stringify(result.errors));
	});

	test("expectedReturn=true with top-level return → ok", () => {
		const body = [{ kind: "return", value: { lit: 1 } }];
		const result = validateOperationBody(body, { ...baseCtx, expectedReturn: true });
		assert.equal(result.ok, true, JSON.stringify(result.errors));
	});

	test("expectedReturn=true with branch (then return + else return) → ok", () => {
		const body = [
			{
				kind: "branch",
				if: { ref: "$.input.flag" },
				then: [{ kind: "return", value: { lit: true } }],
				else: [{ kind: "return", value: { lit: false } }],
			},
		];
		const result = validateOperationBody(body, { ...baseCtx, expectedReturn: true });
		assert.equal(result.ok, true, JSON.stringify(result.errors));
	});

	test("expectedReturn=true with branch missing else → fail", () => {
		const body = [
			{
				kind: "branch",
				if: { ref: "$.input.flag" },
				then: [{ kind: "return", value: { lit: true } }],
			},
		];
		const result = validateOperationBody(body, { ...baseCtx, expectedReturn: true });
		assert.equal(result.ok, false);
		assert.ok(result.errors.some((e) => e.code === "missing_return"), JSON.stringify(result.errors));
	});
});

// ─── PolicyRule — Zod parse ───────────────────────────────────────────────────

describe("policyRuleSchema — valid rules", () => {
	test("parses eq rule", () => {
		const result = policyRuleSchema.safeParse({
			eq: [{ ref: "$.auth.userId" }, { ref: "$.record.ownerId" }],
		});
		assert.equal(result.success, true);
	});

	test("parses all combinator", () => {
		const result = policyRuleSchema.safeParse({
			all: [
				{ eq: [{ ref: "$.auth.userId" }, { ref: "$.record.ownerId" }] },
				{ exists: { ref: "$.auth.userId" } },
			],
		});
		assert.equal(result.success, true);
	});

	test("parses any combinator", () => {
		const result = policyRuleSchema.safeParse({
			any: [
				{ eq: [{ lit: 1 }, { lit: 1 }] },
				{ eq: [{ lit: 2 }, { lit: 3 }] },
			],
		});
		assert.equal(result.success, true);
	});

	test("parses not combinator", () => {
		const result = policyRuleSchema.safeParse({
			not: { exists: { ref: "$.auth.userId" } },
		});
		assert.equal(result.success, true);
	});

	test("parses in rule", () => {
		const result = policyRuleSchema.safeParse({
			in: [{ ref: "$.auth.role" }, { lit: ["admin", "moderator"] }],
		});
		// lit with array — note: lit accepts any JSON value, this is valid schema
		// However lit only accepts string|number|boolean|null per exprSchema.
		// So this may fail. Let's check and adjust.
		// If it fails, that's correct behavior — use arr instead.
		// We'll test a valid arr form:
		const result2 = policyRuleSchema.safeParse({
			in: [{ ref: "$.auth.role" }, { arr: [{ lit: "admin" }, { lit: "moderator" }] }],
		});
		assert.equal(result2.success, true);
	});

	test("parses matches rule", () => {
		const result = policyRuleSchema.safeParse({
			matches: [{ ref: "$.input.email" }, "^[^@]+@[^@]+$"],
		});
		assert.equal(result.success, true);
	});

	test("parses gt/gte/lt/lte rules", () => {
		for (const key of ["gt", "gte", "lt", "lte"] as const) {
			const result = policyRuleSchema.safeParse({
				[key]: [{ ref: "$.record.age" }, { lit: 18 }],
			});
			assert.equal(result.success, true, `${key} should parse`);
		}
	});
});

// ─── validatePolicyRule ───────────────────────────────────────────────────────

describe("validatePolicyRule", () => {
	test("valid eq rule returns ok:true", () => {
		const result = validatePolicyRule({
			eq: [{ ref: "$.auth.userId" }, { ref: "$.record.ownerId" }],
		});
		assert.equal(result.ok, true);
	});

	test("invalid regex in matches returns error", () => {
		const result = validatePolicyRule({
			matches: [{ ref: "$.input.email" }, "[invalid("],
		});
		assert.equal(result.ok, false);
		assert.ok(result.errors.some((e) => e.code === "invalid_regex"));
	});

	test("bad Expr in exists returns error", () => {
		const result = validatePolicyRule({
			exists: { ref: "nostart" },
		});
		assert.equal(result.ok, false);
		assert.ok(result.errors.some((e) => e.code === "ref_no_dollar_dot"));
	});

	test("nested all/any/not recursion validated", () => {
		const result = validatePolicyRule({
			all: [
				{ not: { exists: { ref: "$.auth.userId" } } },
				{ any: [{ eq: [{ lit: 1 }, { lit: 1 }] }] },
			],
		});
		assert.equal(result.ok, true);
	});

	test("all with empty array → fail (empty_combinator)", () => {
		const result = validatePolicyRule({ all: [] });
		assert.equal(result.ok, false);
		assert.ok(result.errors.some((e) => e.code === "empty_combinator"), JSON.stringify(result.errors));
	});

	test("any with empty array → fail (empty_combinator)", () => {
		const result = validatePolicyRule({ any: [] });
		assert.equal(result.ok, false);
		assert.ok(result.errors.some((e) => e.code === "empty_combinator"), JSON.stringify(result.errors));
	});
});

// ─── evalPolicyRule ───────────────────────────────────────────────────────────

describe("evalPolicyRule", () => {
	const scope = { auth: { userId: "u1" }, record: { ownerId: "u1", age: 25 } };

	test("eq — matching values → true", () => {
		const rule = { eq: [{ ref: "$.auth.userId" }, { ref: "$.record.ownerId" }] } as const;
		assert.equal(evalPolicyRule(rule as never, scope), true);
	});

	test("neq — different values → true", () => {
		const rule = { neq: [{ ref: "$.auth.userId" }, { lit: "other" }] } as const;
		assert.equal(evalPolicyRule(rule as never, scope), true);
	});

	test("in — value in array → true", () => {
		const rule = {
			in: [{ lit: "u1" }, { arr: [{ lit: "u1" }, { lit: "u2" }] }],
		} as const;
		assert.equal(evalPolicyRule(rule as never, scope), true);
	});

	test("in — value not in array → false", () => {
		const rule = {
			in: [{ lit: "u99" }, { arr: [{ lit: "u1" }, { lit: "u2" }] }],
		} as const;
		assert.equal(evalPolicyRule(rule as never, scope), false);
	});

	test("gt — 25 > 18 → true", () => {
		const rule = { gt: [{ ref: "$.record.age" }, { lit: 18 }] } as const;
		assert.equal(evalPolicyRule(rule as never, scope), true);
	});

	test("gte — 25 >= 25 → true", () => {
		const rule = { gte: [{ ref: "$.record.age" }, { lit: 25 }] } as const;
		assert.equal(evalPolicyRule(rule as never, scope), true);
	});

	test("lt — 25 < 30 → true", () => {
		const rule = { lt: [{ ref: "$.record.age" }, { lit: 30 }] } as const;
		assert.equal(evalPolicyRule(rule as never, scope), true);
	});

	test("lte — 25 <= 25 → true", () => {
		const rule = { lte: [{ ref: "$.record.age" }, { lit: 25 }] } as const;
		assert.equal(evalPolicyRule(rule as never, scope), true);
	});

	test("exists — present value → true", () => {
		const rule = { exists: { ref: "$.auth.userId" } } as const;
		assert.equal(evalPolicyRule(rule as never, scope), true);
	});

	test("exists — missing value → false", () => {
		const rule = { exists: { ref: "$.auth.missing" } } as const;
		assert.equal(evalPolicyRule(rule as never, scope), false);
	});

	test("matches — regex match → true", () => {
		const s = { input: { email: "user@example.com" } };
		const rule = { matches: [{ ref: "$.input.email" }, "^[^@]+@[^@]+$"] } as const;
		assert.equal(evalPolicyRule(rule as never, s), true);
	});

	test("all — both true → true", () => {
		const rule = {
			all: [
				{ eq: [{ lit: 1 }, { lit: 1 }] },
				{ eq: [{ lit: 2 }, { lit: 2 }] },
			],
		} as const;
		assert.equal(evalPolicyRule(rule as never, {}), true);
	});

	test("all — one false → false", () => {
		const rule = {
			all: [
				{ eq: [{ lit: 1 }, { lit: 1 }] },
				{ eq: [{ lit: 1 }, { lit: 2 }] },
			],
		} as const;
		assert.equal(evalPolicyRule(rule as never, {}), false);
	});

	test("any — one true → true", () => {
		const rule = {
			any: [
				{ eq: [{ lit: 1 }, { lit: 2 }] },
				{ eq: [{ lit: 3 }, { lit: 3 }] },
			],
		} as const;
		assert.equal(evalPolicyRule(rule as never, {}), true);
	});

	test("not — negates true → false", () => {
		const rule = { not: { eq: [{ lit: 1 }, { lit: 1 }] } } as const;
		assert.equal(evalPolicyRule(rule as never, {}), false);
	});
});

// ─── collectOperationXxx ─────────────────────────────────────────────────────

describe("collectOperationEntities", () => {
	test("collects from read and mutate steps", () => {
		const body = [
			{ kind: "read", entity: "User", as: "u" },
			{ kind: "mutate", op: "create" as const, entity: "TodoList", data: { lit: null } },
		];
		const result = collectOperationEntities(body as never);
		assert.deepEqual(result, ["TodoList", "User"]);
	});

	test("collects from nested branch steps", () => {
		const body = [
			{
				kind: "branch",
				if: { lit: true },
				then: [{ kind: "read", entity: "TodoList", as: "list" }],
			},
		];
		const result = collectOperationEntities(body as never);
		assert.deepEqual(result, ["TodoList"]);
	});

	test("deduplicates", () => {
		const body = [
			{ kind: "read", entity: "User", as: "u1" },
			{ kind: "read", entity: "User", as: "u2" },
		];
		const result = collectOperationEntities(body as never);
		assert.deepEqual(result, ["User"]);
	});
});

describe("collectOperationPolicies", () => {
	test("collects policy names from authorize steps", () => {
		const body = [
			{ kind: "authorize", policy: "owner-only" },
			{ kind: "authorize", policy: "admin-only" },
		];
		const result = collectOperationPolicies(body as never);
		assert.deepEqual(result, ["admin-only", "owner-only"]);
	});
});

describe("collectOperationIntegrations", () => {
	test("collects integration keys from callIntegration steps", () => {
		const body = [
			{
				kind: "callIntegration",
				integration: "email",
				capability: "send",
				input: { lit: null },
			},
		];
		const result = collectOperationIntegrations(body as never);
		assert.deepEqual(result, ["email"]);
	});
});

describe("collectOperationEvents", () => {
	test("collects event names from emitEvent steps", () => {
		const body = [
			{ kind: "emitEvent", event: "list.created", payload: { lit: null } },
		];
		const result = collectOperationEvents(body as never);
		assert.deepEqual(result, ["list.created"]);
	});
});

describe("collectOperationReads", () => {
	test("collects only read entities, not mutate", () => {
		const body = [
			{ kind: "read", entity: "User", as: "u" },
			{ kind: "mutate", op: "create" as const, entity: "TodoList", data: { lit: null } },
		];
		const result = collectOperationReads(body as never);
		assert.deepEqual(result, ["User"]);
	});

	test("collects reads from nested branch steps", () => {
		const body = [
			{ kind: "read", entity: "User", as: "u" },
			{
				kind: "branch",
				if: { lit: true },
				then: [{ kind: "read", entity: "TodoList", as: "list" }],
				else: [{ kind: "read", entity: "TodoList", as: "list2" }],
			},
		];
		const result = collectOperationReads(body as never);
		assert.deepEqual(result, ["TodoList", "User"]);
	});
});

describe("collectOperationWrites", () => {
	test("collects only mutate entities, not read", () => {
		const body = [
			{ kind: "read", entity: "User", as: "u" },
			{ kind: "mutate", op: "create" as const, entity: "TodoList", data: { lit: null } },
			{ kind: "mutate", op: "update" as const, entity: "User", data: { lit: null }, where: { lit: null } },
		];
		const result = collectOperationWrites(body as never);
		assert.deepEqual(result, ["TodoList", "User"]);
	});
});
