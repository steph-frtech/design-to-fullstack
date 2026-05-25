# Policy DSL (typed AST, Phase 9)

Policies authorize who can do what. A `Policy.rule` is a recursive
**expression-tree** (JSON AST) that compiles to three targets:
in-process predicate evaluator, Prisma where-clause, and (V2) Postgres RLS.

Source: `backend/src/lib/dsl/policy-dsl.ts`

---

## Type definition

```ts
type PolicyRule =
  | { all: PolicyRule[] }           // logical AND — array must not be empty
  | { any: PolicyRule[] }           // logical OR  — array must not be empty
  | { not: PolicyRule }             // logical NOT
  | { eq:  [Expr, Expr] }           // strict equality
  | { neq: [Expr, Expr] }           // strict inequality
  | { in:  [Expr, Expr] }           // left ∈ right (right should be arr Expr)
  | { gt:  [Expr, Expr] }           // left > right
  | { gte: [Expr, Expr] }           // left >= right
  | { lt:  [Expr, Expr] }           // left < right
  | { lte: [Expr, Expr] }           // left <= right
  | { exists: Expr }                // value is not null/undefined
  | { matches: [Expr, string] }     // regex test — pattern is a string literal
```

`POLICY_RULE_OPS = ["all","any","not","eq","neq","in","gt","gte","lt","lte","exists","matches"]`

---

## Operator reference

| Operator  | Shape                        | Semantics                                |
|-----------|------------------------------|------------------------------------------|
| `all`     | `{ all: PolicyRule[] }`      | All child rules must pass (AND). Non-empty.|
| `any`     | `{ any: PolicyRule[] }`      | At least one must pass (OR). Non-empty.  |
| `not`     | `{ not: PolicyRule }`        | Negates the child rule.                  |
| `eq`      | `{ eq: [Expr, Expr] }`       | Strict equality (`===`).                 |
| `neq`     | `{ neq: [Expr, Expr] }`      | Strict inequality (`!==`).               |
| `in`      | `{ in: [Expr, Expr] }`       | Left value is included in right array.   |
| `gt`      | `{ gt: [Expr, Expr] }`       | Left > right (numeric comparison).       |
| `gte`     | `{ gte: [Expr, Expr] }`      | Left >= right.                           |
| `lt`      | `{ lt: [Expr, Expr] }`       | Left < right.                            |
| `lte`     | `{ lte: [Expr, Expr] }`      | Left <= right.                           |
| `exists`  | `{ exists: Expr }`           | Expr evaluates to non-null/non-undefined.|
| `matches` | `{ matches: [Expr, string] }` | `new RegExp(pattern).test(value)`.      |

---

## Expr leaves

Policy rules use the same typed `Expr` AST as Operation steps:

| Form   | Shape                                   | Example                         |
|--------|-----------------------------------------|---------------------------------|
| `lit`  | `{ "lit": string\|number\|boolean\|null }` | `{ "lit": "admin" }`         |
| `ref`  | `{ "ref": "$.root.path" }`             | `{ "ref": "$.auth.userId" }`  |
| `call` | `{ "call": "fn", "args": Expr[] }`     | `{ "call": "lowercase", "args": [...] }` |
| `obj`  | `{ "obj": Record<string, Expr> }`      | not common in policies          |
| `arr`  | `{ "arr": Expr[] }`                    | `{ "arr": [{ "lit": "a" }] }` |

Available ref roots: `input`, `auth`, `record`, `records`, `system`, `env`,
`params`, `query`, plus step aliases from `as` when evaluated inside an Operation.

---

## Examples

### `authenticated-only` — anyone signed in

```json
{ "exists": { "ref": "$.auth.userId" } }
```

### `owner-only` — record owner matches current user

```json
{
  "all": [
    { "exists": { "ref": "$.auth.userId" } },
    { "eq": [{ "ref": "$.auth.userId" }, { "ref": "$.record.ownerId" }] }
  ]
}
```

### `admin-or-owner` — composite with `any`

```json
{
  "any": [
    { "eq": [{ "ref": "$.auth.role" }, { "lit": "admin" }] },
    { "eq": [{ "ref": "$.auth.userId" }, { "ref": "$.record.ownerId" }] }
  ]
}
```

### `email-format` — regex validation

```json
{
  "matches": [{ "ref": "$.input.email" }, "^[^@]+@[^@]+\\.[^@]+$"]
}
```

### `adult-only` — numeric comparison

```json
{ "gte": [{ "ref": "$.auth.age" }, { "lit": 18 }] }
```

### `transferMoney` — role in set

```json
{
  "in": [
    { "ref": "$.auth.role" },
    { "arr": [{ "lit": "admin" }, { "lit": "finance" }] }
  ]
}
```

---

## Policy scopes

| Scope       | Applies to                                                    |
|-------------|---------------------------------------------------------------|
| `OPERATION` | A specific `Operation` call (field: `operationId`)            |
| `RESOURCE`  | Every op of a Resource (field: `resourceId`)                  |
| `ENTITY`    | Row-level access on an Entity (field: `entityId`)             |
| `FIELD`     | Exclude/mask one field of an Entity (`entityId` + `fieldName`)|

A Policy's `effect` is `ALLOW` or `DENY`. Multiple policies on the same
target compose: ALL must allow, ANY DENY blocks.

---

## Static validation

### `validatePolicyRule(rule, ctx?)`

Source: `backend/src/lib/dsl/policy-validate.ts`

```ts
type PolicyValidateCtx = {
  availableStepAliases?: string[];  // passed to validateExpr
}
```

Checks performed:
- Zod parse of the full recursive tree.
- All `Expr` nodes validated with `validateExpr` (ref roots, call arity).
- `all` and `any` arrays must be non-empty (`empty_combinator` error).
- `matches[1]` pattern validated as a syntactically valid `RegExp` (catches `SyntaxError`).

Returns `{ ok: boolean; errors: { path, code, message }[] }`.

---

## Compilation targets

### Target 1 — in-process evaluator (V1, always)

`evalPolicyRule(rule, scope) → boolean`. Walks the tree recursively,
evaluates `Expr` leaves against the scope. Pure function, no I/O.
Used by middleware before every Operation invocation.

### Target 2 — Prisma `where` clause (V1, partial)

For `scope=ENTITY` policies on Resource list/read, the rule is compiled
into a Prisma where filter injected at query time:

```ts
// Policy: eq($.record.ownerId, $.auth.userId)
// Compiled:
{ where: { ownerId: { equals: ctx.auth.userId } } }
```

Restriction: leaves must be `ref` paths to `$.record.<field>` (left) or
`$.auth.*` / `$.system.*` / literal (right). Function calls push the
rule to runtime-only post-filtering.

### Target 3 — Postgres RLS (V2)

```sql
CREATE POLICY is_todo_list_owner
  ON dtfs."TodoList"
  USING ("ownerId" = current_setting('app.user_id', true));
```

Defense-in-depth: RLS holds even if application code is bypassed.

---

## What Policy cannot do

- **Cross-entity reads** ("user can access this if they belong to the team") —
  requires a `read` step, not supported inside a policy rule. Workaround: embed
  the necessary FK directly on the row.
- **External calls** — Policies are pure. For external ACL, cache the result in
  the DB and reference it via `$.record.*`.
- **Stateful checks** (rate limiting) — V1.x will add a dedicated guard.

---

## MCP tools

| Tool                         | Description                             |
|------------------------------|-----------------------------------------|
| `dtfs__validate_policy_rule` | Validate a PolicyRule tree (Zod + Expr + regex). |
| `dtfs__list_policy_rule_ops` | List all 12 PolicyRule operators.       |

## HTTP endpoints

```
GET  /api/projects/:id/operation-dsl/policy-ops      → { ops }
POST /api/projects/:id/operation-dsl/validate-policy  { rule } → { ok, errors }
```
