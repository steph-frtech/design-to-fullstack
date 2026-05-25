// Static analysis for the typed Expr AST.

import type { Expr } from "./expr-ast";

type InferredType =
	| "string"
	| "number"
	| "boolean"
	| "null"
	| "object"
	| "array"
	| "unknown";

const CALL_RETURN_TYPES: Record<string, InferredType> = {
	lowercase:   "string",
	uppercase:   "string",
	trim:        "string",
	concat:      "string",
	length:      "number",
	now:         "string",
	uuid:        "string",
	randomToken: "string",
};

export function collectExprRefs(expr: Expr): string[] {
	const refs = new Set<string>();
	gatherRefs(expr, refs);
	return Array.from(refs).sort();
}

export function collectExprCalls(expr: Expr): string[] {
	const calls = new Set<string>();
	gatherCalls(expr, calls);
	return Array.from(calls).sort();
}

export function inferExprType(expr: Expr): InferredType {
	if ("lit" in expr) {
		if (expr.lit === null) return "null";
		const t = typeof expr.lit;
		if (t === "string") return "string";
		if (t === "number") return "number";
		if (t === "boolean") return "boolean";
		return "unknown";
	}

	if ("ref" in expr) return "unknown";

	if ("call" in expr) {
		return CALL_RETURN_TYPES[expr.call] ?? "unknown";
	}

	if ("obj" in expr) return "object";

	if ("arr" in expr) return "array";

	return "unknown";
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function gatherRefs(expr: Expr, acc: Set<string>): void {
	if ("ref" in expr) {
		acc.add(expr.ref);
		return;
	}
	if ("call" in expr) {
		for (const arg of expr.args) gatherRefs(arg, acc);
		return;
	}
	if ("obj" in expr) {
		for (const val of Object.values(expr.obj)) gatherRefs(val, acc);
		return;
	}
	if ("arr" in expr) {
		for (const item of expr.arr) gatherRefs(item, acc);
		return;
	}
	// lit — no refs
}

function gatherCalls(expr: Expr, acc: Set<string>): void {
	if ("call" in expr) {
		acc.add(expr.call);
		for (const arg of expr.args) gatherCalls(arg, acc);
		return;
	}
	if ("obj" in expr) {
		for (const val of Object.values(expr.obj)) gatherCalls(val, acc);
		return;
	}
	if ("arr" in expr) {
		for (const item of expr.arr) gatherCalls(item, acc);
		return;
	}
	// lit, ref — no calls
}
