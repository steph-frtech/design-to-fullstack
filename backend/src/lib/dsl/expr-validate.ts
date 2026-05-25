// Validation logic for the typed Expr AST.

import { EXPR_FUNCTIONS, EXPR_ROOTS, exprSchema, type Expr } from "./expr-ast";

export type ExprError = { path: string; code: string; message: string };
export type ValidateExprResult = { ok: boolean; errors: ExprError[] };
export type ValidateExprCtx = { availableStepAliases?: string[] };

export function validateExpr(
	expr: unknown,
	ctx: ValidateExprCtx = {},
): ValidateExprResult {
	const errors: ExprError[] = [];

	// 1. Zod parse
	const parsed = exprSchema.safeParse(expr);
	if (!parsed.success) {
		for (const issue of parsed.error.issues) {
			errors.push({
				path: issue.path.join("."),
				code: "zod_parse",
				message: issue.message,
			});
		}
		return { ok: false, errors };
	}

	// 2. Semantic validation
	validateNode(parsed.data, "$", ctx, errors);

	return { ok: errors.length === 0, errors };
}

function validateNode(
	node: Expr,
	path: string,
	ctx: ValidateExprCtx,
	errors: ExprError[],
): void {
	if ("lit" in node) {
		// literals are always valid
		return;
	}

	if ("ref" in node) {
		validateRef(node.ref, path, ctx, errors);
		return;
	}

	if ("call" in node) {
		validateCall(node.call, node.args, path, ctx, errors);
		return;
	}

	if ("obj" in node) {
		for (const [key, val] of Object.entries(node.obj)) {
			validateNode(val, `${path}.obj.${key}`, ctx, errors);
		}
		return;
	}

	if ("arr" in node) {
		node.arr.forEach((item, i) => {
			validateNode(item, `${path}.arr[${i}]`, ctx, errors);
		});
		return;
	}
}

function validateRef(
	ref: string,
	path: string,
	ctx: ValidateExprCtx,
	errors: ExprError[],
): void {
	if (!ref.startsWith("$.")) {
		errors.push({
			path,
			code: "ref_no_dollar_dot",
			message: `ref must start with "$." — got "${ref}"`,
		});
		return;
	}

	// Extract the root segment (between "$." and the next ".")
	const rest = ref.slice(2); // remove "$."
	const root = rest.split(".")[0] ?? "";

	const validRoots = new Set<string>([
		...EXPR_ROOTS,
		...(ctx.availableStepAliases ?? []),
	]);

	if (!validRoots.has(root)) {
		errors.push({
			path,
			code: "ref_unknown_root",
			message: `unknown root "$.${root}" — allowed: ${[...validRoots].join(", ")}`,
		});
	}
}

function validateCall(
	name: string,
	args: Expr[],
	path: string,
	ctx: ValidateExprCtx,
	errors: ExprError[],
): void {
	const fn = EXPR_FUNCTIONS[name];
	if (!fn) {
		errors.push({
			path,
			code: "call_unknown_function",
			message: `unknown function "${name}" — allowed: ${Object.keys(EXPR_FUNCTIONS).join(", ")}`,
		});
	} else {
		// Arity check
		if (fn.args === -1) {
			// variadique — accept >= 1
			if (args.length < 1) {
				errors.push({
					path,
					code: "call_arity",
					message: `"${name}" is variadic and requires at least 1 argument`,
				});
			}
		} else if (args.length !== fn.args) {
			errors.push({
				path,
				code: "call_arity",
				message: `"${name}" expects ${fn.args} argument(s), got ${args.length}`,
			});
		}
	}

	// Recurse into args regardless of function validity
	args.forEach((arg, i) => {
		validateNode(arg, `${path}.args[${i}]`, ctx, errors);
	});
}
