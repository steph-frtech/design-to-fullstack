# Expr DSL — Expression Language

`Expr` is the expression syntax used in Step DSL data/where/input fields,
in Policy DSL leaves, and anywhere the platform needs to reference data or
compute a value declaratively.

The platform now ships two coexisting representations:

| Variant | Status | When to use |
|---------|--------|-------------|
| **JSONata string** (`expr.ts`) | Legacy / V1 | Existing operations, Policy compiler |
| **Typed AST JSON** (`expr-ast.ts`) | Active / V2 | New operations, LLM authoring, static analysis |

The typed AST is the recommended form going forward. JSONata strings
remain supported for backward compatibility.

---

## Type definition (AST JSON)

```ts
export type Expr =
  | { lit: string | number | boolean | null }   // literal value
  | { ref: string }                              // path lookup, e.g. "$.input.title"
  | { call: string; args: Expr[] }               // function application
  | { obj: Record<string, Expr> }               // object construction
  | { arr: Expr[] }                             // array construction
```

All five variants are discriminated by their sole structural key.

### Zod schema

```ts
import { exprSchema } from "backend/src/lib/dsl/expr-ast";

const result = exprSchema.safeParse(someJson); // recursive, validates all nesting
```

---

## Roots — what is available in scope

Refs must start with `$.` followed by one of these roots:

| Root        | Description                                               |
|-------------|-----------------------------------------------------------|
| `$.input`   | Operation input (the validated request body)              |
| `$.auth`    | Auth context — `$.auth.user.id`, `$.auth.user.role`, ... |
| `$.record`  | Current DB row (Policy ENTITY scope)                      |
| `$.records` | Array of rows (list operations)                           |
| `$.system`  | Platform helpers — `$.system.now`, etc.                   |
| `$.env`     | Allowlisted env vars (read-only)                          |
| `$.params`  | Path params from the request URL                          |
| `$.query`   | Query string params                                       |
| `$.<alias>` | Any step alias bound by a prior Step via `as: "..."`      |

Validation accepts additional roots via `ctx.availableStepAliases`.

---

## Function catalogue

Eight built-in functions (see `EXPR_FUNCTIONS` in `expr-ast.ts`):

| Name          | Arity     | Pure  | Return type | Description                          |
|---------------|-----------|-------|-------------|--------------------------------------|
| `lowercase`   | 1         | yes   | string      | Lowercase a string                   |
| `uppercase`   | 1         | yes   | string      | Uppercase a string                   |
| `trim`        | 1         | yes   | string      | Strip leading/trailing whitespace    |
| `concat`      | variadic  | yes   | string      | Concatenate multiple values as strings|
| `length`      | 1         | yes   | number      | Length of string or array            |
| `now`         | 0         | no    | string      | ISO 8601 timestamp at evaluation time|
| `uuid`        | 0         | no    | string      | `crypto.randomUUID()`                |
| `randomToken` | 0         | no    | string      | 16-byte hex via `crypto.randomBytes` |

`concat` is variadic: arity `-1` means it accepts ≥ 1 argument.

---

## Examples

### Literal

```json
{ "lit": "hello world" }
{ "lit": 42 }
{ "lit": true }
{ "lit": null }
```

### Reference

```json
{ "ref": "$.input.title" }
{ "ref": "$.auth.user.id" }
{ "ref": "$.myStep.result.id" }
```

### Function call

```json
{ "call": "lowercase", "args": [{ "ref": "$.input.email" }] }
```

```json
{
  "call": "concat",
  "args": [
    { "lit": "Hello, " },
    { "ref": "$.auth.user.name" },
    { "lit": "!" }
  ]
}
```

### Object construction

```json
{
  "obj": {
    "title": { "call": "trim", "args": [{ "ref": "$.input.title" }] },
    "ownerId": { "ref": "$.auth.user.id" },
    "createdAt": { "call": "now", "args": [] }
  }
}
```

### Nested call

```json
{
  "call": "concat",
  "args": [
    { "ref": "$.input.firstName" },
    { "lit": " " },
    { "call": "uppercase", "args": [{ "ref": "$.input.lastName" }] }
  ]
}
```

---

## API surface

### HTTP endpoints (mounted per project)

```
POST /api/projects/:id/expr/validate
  body: { expr: Expr, stepAliases?: string[] }
  → { ok: boolean, errors: { path, code, message }[] }

POST /api/projects/:id/expr/eval
  body: { expr: Expr, scope: object }
  → { value: unknown }  |  { error: string } (400)

POST /api/projects/:id/expr/analyze
  body: { expr: Expr }
  → { refs: string[], calls: string[], inferredType: string }
```

### MCP tools

- `dtfs__validate_expr({ expr, stepAliases? })` — validate AST
- `dtfs__eval_expr({ expr, scope })` — evaluate against a scope
- `dtfs__analyze_expr({ expr })` — collect refs, calls, infer type

### Library functions

```ts
import { validateExpr } from "backend/src/lib/dsl/expr-validate";
import { evalExpr }     from "backend/src/lib/dsl/expr-eval";
import { collectExprRefs, collectExprCalls, inferExprType }
  from "backend/src/lib/dsl/expr-analyze";
```

---

## Cohabitation with JSONata (migration guide)

The legacy `evalExpr(src: string, ctx)` in `expr.ts` (wrapping JSONata)
is still exported and used by the Policy compiler and any V1 operations.
It is not removed.

The new typed AST lives in `expr-ast.ts`, `expr-validate.ts`,
`expr-eval.ts`, `expr-analyze.ts`. New operations and LLM-authored steps
should use the AST form.

Migration path per operation step:

1. Identify JSONata strings in the `body` / `steps` array.
2. Rewrite each string as a typed `Expr` node.
3. Use `validateExpr` to lint at authoring time.
4. The Step runtime calls `evalExpr(expr, scope)` from `expr-eval.ts`.

There is no forced migration deadline. Both forms coexist.
