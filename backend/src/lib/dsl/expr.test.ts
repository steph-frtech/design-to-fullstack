// Unit tests for the Expr DSL.
// Uses node:test + assert (no Vitest installed in backend).

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateExpr } from "./expr-validate";
import { evalExpr } from "./expr-eval";
import { collectExprCalls, collectExprRefs, inferExprType } from "./expr-analyze";

// ─── validateExpr ──────────────────────────────────────────────────────────

describe("validateExpr", () => {
	it("accepts { lit: 'x' }", () => {
		const r = validateExpr({ lit: "x" });
		assert.equal(r.ok, true);
		assert.equal(r.errors.length, 0);
	});

	it("accepts { ref: '$.input.title' }", () => {
		const r = validateExpr({ ref: "$.input.title" });
		assert.equal(r.ok, true);
	});

	it("rejects { ref: '$.nope' } — unknown root", () => {
		const r = validateExpr({ ref: "$.nope" });
		assert.equal(r.ok, false);
		assert.ok(r.errors.some((e) => e.code === "ref_unknown_root"));
	});

	it("accepts { ref: '$.myStep.field' } when stepAlias provided", () => {
		const r = validateExpr({ ref: "$.myStep.field" }, { availableStepAliases: ["myStep"] });
		assert.equal(r.ok, true);
	});

	it("accepts call lowercase with 1 arg", () => {
		const r = validateExpr({ call: "lowercase", args: [{ ref: "$.input.title" }] });
		assert.equal(r.ok, true);
	});

	it("rejects call lowercase with 0 args — arity error", () => {
		const r = validateExpr({ call: "lowercase", args: [] });
		assert.equal(r.ok, false);
		assert.ok(r.errors.some((e) => e.code === "call_arity"));
	});

	it("rejects call to unknown function", () => {
		const r = validateExpr({ call: "unknown", args: [] });
		assert.equal(r.ok, false);
		assert.ok(r.errors.some((e) => e.code === "call_unknown_function"));
	});

	it("accepts concat with >= 1 args (variadique)", () => {
		const r = validateExpr({
			call: "concat",
			args: [{ lit: "a" }, { lit: "b" }],
		});
		assert.equal(r.ok, true);
	});

	it("rejects concat with 0 args (variadique needs >= 1)", () => {
		const r = validateExpr({ call: "concat", args: [] });
		assert.equal(r.ok, false);
	});

	it("rejects ref missing $. prefix", () => {
		const r = validateExpr({ ref: "input.title" });
		assert.equal(r.ok, false);
		assert.ok(r.errors.some((e) => e.code === "ref_no_dollar_dot"));
	});
});

// ─── evalExpr ──────────────────────────────────────────────────────────────

describe("evalExpr", () => {
	it("evaluates lit string", () => {
		assert.equal(evalExpr({ lit: "hello" }, {}), "hello");
	});

	it("evaluates lit null", () => {
		assert.equal(evalExpr({ lit: null }, {}), null);
	});

	it("evaluates ref $.input.title", () => {
		const result = evalExpr({ ref: "$.input.title" }, { input: { title: "Hi" } });
		assert.equal(result, "Hi");
	});

	it("evaluates ref to undefined for missing path", () => {
		const result = evalExpr({ ref: "$.input.missing" }, { input: {} });
		assert.equal(result, undefined);
	});

	it("evaluates call concat", () => {
		const result = evalExpr(
			{ call: "concat", args: [{ lit: "hello " }, { lit: "world" }] },
			{},
		);
		assert.equal(result, "hello world");
	});

	it("evaluates call lowercase", () => {
		const result = evalExpr(
			{ call: "lowercase", args: [{ lit: "HELLO" }] },
			{},
		);
		assert.equal(result, "hello");
	});

	it("evaluates call uppercase", () => {
		const result = evalExpr({ call: "uppercase", args: [{ lit: "hi" }] }, {});
		assert.equal(result, "HI");
	});

	it("evaluates call trim", () => {
		assert.equal(evalExpr({ call: "trim", args: [{ lit: "  x  " }] }, {}), "x");
	});

	it("evaluates call length on string", () => {
		assert.equal(evalExpr({ call: "length", args: [{ lit: "abc" }] }, {}), 3);
	});

	it("evaluates call now — returns ISO string", () => {
		const result = evalExpr({ call: "now", args: [] }, {});
		assert.ok(typeof result === "string");
		assert.ok(!Number.isNaN(Date.parse(result as string)));
	});

	it("evaluates call uuid — returns a UUID-like string", () => {
		const result = evalExpr({ call: "uuid", args: [] }, {});
		assert.ok(typeof result === "string");
		assert.ok((result as string).length > 0);
	});

	it("evaluates call randomToken — returns 32-char hex", () => {
		const result = evalExpr({ call: "randomToken", args: [] }, {});
		assert.ok(typeof result === "string");
		assert.ok((result as string).length === 32);
	});

	it("evaluates obj", () => {
		const result = evalExpr(
			{ obj: { name: { ref: "$.input.name" }, code: { lit: 42 } } },
			{ input: { name: "Alice" } },
		);
		assert.deepEqual(result, { name: "Alice", code: 42 });
	});

	it("evaluates arr", () => {
		const result = evalExpr(
			{ arr: [{ lit: 1 }, { lit: 2 }, { lit: 3 }] },
			{},
		);
		assert.deepEqual(result, [1, 2, 3]);
	});
});

// ─── collect / infer ───────────────────────────────────────────────────────

describe("collectExprRefs", () => {
	it("returns sorted unique refs from a nested expr", () => {
		const expr = {
			call: "concat",
			args: [
				{ ref: "$.input.a" },
				{ call: "uppercase", args: [{ ref: "$.input.b" }] },
				{ ref: "$.input.a" }, // duplicate
			],
		};
		// biome-ignore lint/suspicious/noExplicitAny: test cast
		const refs = collectExprRefs(expr as any);
		assert.deepEqual(refs, ["$.input.a", "$.input.b"]);
	});
});

describe("collectExprCalls", () => {
	it("returns sorted unique call names from a nested expr", () => {
		const expr = {
			call: "concat",
			args: [
				{ ref: "$.input.a" },
				{ call: "uppercase", args: [{ ref: "$.input.b" }] },
			],
		};
		// biome-ignore lint/suspicious/noExplicitAny: test cast
		const calls = collectExprCalls(expr as any);
		assert.deepEqual(calls, ["concat", "uppercase"]);
	});
});

describe("inferExprType", () => {
	it("infers string for lit string", () => {
		assert.equal(inferExprType({ lit: "x" }), "string");
	});

	it("infers number for lit number", () => {
		assert.equal(inferExprType({ lit: 42 }), "number");
	});

	it("infers boolean for lit boolean", () => {
		assert.equal(inferExprType({ lit: true }), "boolean");
	});

	it("infers null for lit null", () => {
		assert.equal(inferExprType({ lit: null }), "null");
	});

	it("infers unknown for ref", () => {
		assert.equal(inferExprType({ ref: "$.input.x" }), "unknown");
	});

	it("infers string for call lowercase", () => {
		assert.equal(inferExprType({ call: "lowercase", args: [] }), "string");
	});

	it("infers number for call length", () => {
		assert.equal(inferExprType({ call: "length", args: [] }), "number");
	});

	it("infers string for call concat", () => {
		assert.equal(inferExprType({ call: "concat", args: [] }), "string");
	});

	it("infers object for obj", () => {
		assert.equal(inferExprType({ obj: {} }), "object");
	});

	it("infers array for arr", () => {
		assert.equal(inferExprType({ arr: [] }), "array");
	});
});
