// Runtime evaluator for the typed Expr AST.

import { randomBytes } from "node:crypto";
import type { Expr } from "./expr-ast";

export type ExprScope = {
	input?: Record<string, unknown>;
	auth?: unknown;
	record?: Record<string, unknown>;
	records?: unknown[];
	system?: unknown;
	env?: Record<string, string>;
	params?: Record<string, unknown>;
	query?: Record<string, unknown>;
	[stepAlias: string]: unknown;
};

export function evalExpr(expr: Expr, scope: ExprScope): unknown {
	if ("lit" in expr) {
		return expr.lit;
	}

	if ("ref" in expr) {
		return resolveRef(expr.ref, scope);
	}

	if ("call" in expr) {
		return applyCall(expr.call, expr.args, scope);
	}

	if ("obj" in expr) {
		const result: Record<string, unknown> = {};
		for (const [key, val] of Object.entries(expr.obj)) {
			result[key] = evalExpr(val, scope);
		}
		return result;
	}

	if ("arr" in expr) {
		return expr.arr.map((item) => evalExpr(item, scope));
	}

	throw new Error(`evalExpr: unrecognized expr shape: ${JSON.stringify(expr)}`);
}

function resolveRef(ref: string, scope: ExprScope): unknown {
	if (!ref.startsWith("$.")) {
		throw new Error(`evalExpr: ref must start with "$." — got "${ref}"`);
	}

	const segments = ref.slice(2).split(".");
	// biome-ignore lint/suspicious/noExplicitAny: intentional dynamic traversal
	let current: any = scope;
	for (const seg of segments) {
		if (current == null || typeof current !== "object") {
			return undefined;
		}
		current = current[seg];
	}
	return current;
}

const CALL_IMPLS: Record<string, (args: unknown[]) => unknown> = {
	lowercase: ([s]) => String(s ?? "").toLowerCase(),
	uppercase: ([s]) => String(s ?? "").toUpperCase(),
	trim:      ([s]) => String(s ?? "").trim(),
	concat:    (args) => args.map((a) => String(a ?? "")).join(""),
	length:    ([s]) => {
		if (Array.isArray(s)) return s.length;
		return String(s ?? "").length;
	},
	now:         () => new Date().toISOString(),
	uuid:        () => crypto.randomUUID(),
	randomToken: () => randomBytes(16).toString("hex"),
};

function applyCall(name: string, args: Expr[], scope: ExprScope): unknown {
	const impl = CALL_IMPLS[name];
	if (!impl) {
		throw new Error(`evalExpr: unknown function "${name}"`);
	}
	const evaluatedArgs = args.map((a) => evalExpr(a, scope));
	return impl(evaluatedArgs);
}
