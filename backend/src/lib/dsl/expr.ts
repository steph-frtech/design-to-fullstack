// JSONata wrapper for the Step/Policy DSL.
// Expressions are strings parsed by jsonata at validation time.
// Available roots: $.input, $.auth, $.record, $.system, $.env, $.<as-name>

import jsonata from "jsonata";

export type Expr = string;

const ALLOWED_ROOTS = new Set([
	"input",
	"auth",
	"record",
	"system",
	"env",
]);

export type SystemContext = {
	now: string; // ISO 8601
	randomToken: string; // 32-hex token
};

export type ExprEvalContext = {
	input?: Record<string, unknown>;
	auth?: { user?: { id: string; email?: string; role?: string } };
	record?: Record<string, unknown>;
	system?: SystemContext;
	env?: Record<string, string>;
	[asVarName: string]: unknown;
};

// Compile a JSONata expression. Throws if invalid syntax.
export function compileExpr(src: Expr) {
	return jsonata(src);
}

// Best-effort static validation: just try to parse.
export function isValidExpr(src: Expr): { ok: true } | { ok: false; error: string } {
	try {
		jsonata(src);
		return { ok: true };
	} catch (err) {
		return { ok: false, error: (err as Error).message };
	}
}

// Runtime evaluator — used by Policy compiler and (eventually) Step runtime.
export async function evalExpr(
	src: Expr,
	ctx: ExprEvalContext,
): Promise<unknown> {
	return compileExpr(src).evaluate(ctx);
}

export function listExposedRoots(): readonly string[] {
	return Array.from(ALLOWED_ROOTS);
}

export function defaultSystemContext(): SystemContext {
	return {
		now: new Date().toISOString(),
		randomToken: randomHex(32),
	};
}

function randomHex(bytes: number): string {
	const arr = new Uint8Array(bytes);
	crypto.getRandomValues(arr);
	return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}
