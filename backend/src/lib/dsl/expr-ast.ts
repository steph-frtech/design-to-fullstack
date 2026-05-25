// Typed AST JSON for the Step DSL — replaces/complements JSONata strings.
// This file contains only types, schemas, and constants (no logic).

import { z } from "zod";

// ─── Type definition ───────────────────────────────────────────────────────

export type Expr =
	| { lit: string | number | boolean | null }
	| { ref: string }
	| { call: string; args: Expr[] }
	| { obj: Record<string, Expr> }
	| { arr: Expr[] };

// ─── Zod schema (recursive via z.lazy) ────────────────────────────────────

const litSchema = z.object({
	lit: z.union([z.string(), z.number(), z.boolean(), z.null()]),
});

const refSchema = z.object({
	ref: z.string(),
});

// Forward reference for recursive types
// biome-ignore lint/suspicious/noExplicitAny: intentional recursive lazy
const exprSchemaBase: z.ZodType<Expr> = z.lazy(() =>
	z.union([
		litSchema,
		refSchema,
		z.object({
			call: z.string(),
			args: z.array(exprSchemaBase),
		}),
		z.object({
			obj: z.record(exprSchemaBase),
		}),
		z.object({
			arr: z.array(exprSchemaBase),
		}),
	]),
);

export const exprSchema: z.ZodType<Expr> = exprSchemaBase;

// ─── Function catalogue ────────────────────────────────────────────────────

export const EXPR_FUNCTIONS: Record<string, { args: number; pure: boolean }> = {
	lowercase:   { args: 1,  pure: true  },
	uppercase:   { args: 1,  pure: true  },
	trim:        { args: 1,  pure: true  },
	concat:      { args: -1, pure: true  }, // variadique — accepts >= 1
	length:      { args: 1,  pure: true  },
	now:         { args: 0,  pure: false },
	uuid:        { args: 0,  pure: false },
	randomToken: { args: 0,  pure: false },
};

// ─── Allowed roots ─────────────────────────────────────────────────────────

export const EXPR_ROOTS = [
	"input",
	"auth",
	"record",
	"records",
	"system",
	"env",
	"params",
	"query",
] as const;

export type ExprRoot = (typeof EXPR_ROOTS)[number];
