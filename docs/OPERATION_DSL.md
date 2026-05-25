# Operation DSL — Step Language (typed AST, Phase 9)

Each `Operation.steps` is a list of typed `OperationStep` values evaluated
in sequence. The LLM writes declarative steps — no code. Expressions are
typed `Expr` AST nodes (see `docs/EXPR_DSL.md`), not JSONata strings.

Source: `backend/src/lib/dsl/operation-dsl.ts`

---

## Operation.kind

| Value      | Semantics                                          |
|------------|----------------------------------------------------|
| `QUERY`    | Read-only — no mutations, no event emission.       |
| `COMMAND`  | Side-effect — mutations, events, integrations.     |
| `WORKFLOW` | Reserved for V3+ (Temporal). Do not use in V1.    |

---

## OperationStep variants (10)

Every step has a `kind` discriminant. All expression fields accept a typed
`Expr` AST node (`{ lit }`, `{ ref }`, `{ call }`, `{ obj }`, `{ arr }`).

`OPERATION_STEP_KINDS = ["validate","authorize","read","mutate","callIntegration","emitEvent","branch","assert","log","return"]`

### `validate`

```json
{ "kind": "validate", "schema": <JsonSchema> }
```

Validates the input against the provided JSON Schema. Throws a structured
error on mismatch. The schema is any JSON Schema object (not an Expr).

### `authorize`

```json
{ "kind": "authorize", "policy": "owner-only" }
```

Looks up the named `Policy` in the project, evaluates its `PolicyRule`
tree against the current scope. Throws 403 on deny. `policy` must exist
in the project (validated statically).

### `read`

```json
{
  "kind": "read",
  "entity": "TodoList",
  "where": { "obj": { "id": { "ref": "$.input.listId" } } },
  "many": false,
  "as": "list"
}
```

Fetches record(s) from the named entity. `where` and `many` are optional.
Result bound to `$.as` for subsequent steps.

**`as` must match `/^[a-z][a-zA-Z0-9_]*$/`** — starts with lowercase letter.

### `mutate`

```json
{
  "kind": "mutate",
  "op": "create",
  "entity": "TodoList",
  "data": { "obj": { "title": { "ref": "$.input.title" }, "ownerId": { "ref": "$.auth.userId" } } },
  "as": "list"
}
```

`op` ∈ `create | update | delete`. Op-specific field requirements:

| op       | `data` required | `where` required |
|----------|-----------------|------------------|
| `create` | yes             | no               |
| `update` | yes             | yes              |
| `delete` | no              | yes              |

`as` is optional but must match the identifier regex when present.

### `callIntegration`

```json
{
  "kind": "callIntegration",
  "integration": "email",
  "capability": "send",
  "input": { "obj": { "to": { "ref": "$.input.email" }, "subject": { "lit": "Welcome" } } },
  "as": "emailResult"
}
```

Invokes an external integration. `integration` and `capability` are
validated against project integrations. `as` optional.

### `emitEvent`

```json
{
  "kind": "emitEvent",
  "event": "list.created",
  "payload": { "obj": { "id": { "ref": "$.list.id" } } }
}
```

Publishes an internal event. Consumed by `Trigger { kind: "EVENT" }`.
If `eventNames` are known at validation time, `event` is checked.

### `branch`

```json
{
  "kind": "branch",
  "if": { "ref": "$.input.isPublic" },
  "then": [{ "kind": "return", "value": { "lit": "public" } }],
  "else": [{ "kind": "return", "value": { "lit": "private" } }]
}
```

Conditional execution. `else` is optional. Step aliases defined in
`then`/`else` branches are merged and visible to subsequent steps.
When `expectedReturn` is set, BOTH `then` and `else` must contain a return.

### `assert`

```json
{
  "kind": "assert",
  "condition": { "ref": "$.list.id" },
  "message": "list must exist"
}
```

Throws a runtime error if `condition` is falsy.

### `log`

```json
{
  "kind": "log",
  "level": "info",
  "message": { "call": "concat", "args": [{ "lit": "Created: " }, { "ref": "$.list.id" }] }
}
```

Emits a structured log entry. `level` ∈ `info | warn | error`.

### `return`

```json
{ "kind": "return", "value": { "ref": "$.list" } }
```

Returns the value from the operation. Steps after this are unreachable.

---

## Full example: `createTodoList`

```json
[
  { "kind": "authorize", "policy": "authenticated-only" },
  {
    "kind": "mutate",
    "op": "create",
    "entity": "TodoList",
    "data": {
      "obj": {
        "title":   { "ref": "$.input.title" },
        "ownerId": { "ref": "$.auth.userId" }
      }
    },
    "as": "list"
  },
  {
    "kind": "emitEvent",
    "event": "list.created",
    "payload": { "obj": { "id": { "ref": "$.list.id" } } }
  },
  { "kind": "return", "value": { "ref": "$.list" } }
]
```

## Full example: `transferMoney` (with branch)

```json
[
  { "kind": "authorize", "policy": "account-owner" },
  {
    "kind": "read",
    "entity": "Account",
    "where": { "obj": { "id": { "ref": "$.input.fromAccountId" } } },
    "as": "account"
  },
  {
    "kind": "branch",
    "if": { "obj": { "gte": [{ "ref": "$.account.balance" }, { "ref": "$.input.amount" }] } },
    "then": [
      {
        "kind": "mutate",
        "op": "update",
        "entity": "Account",
        "where": { "obj": { "id": { "ref": "$.input.fromAccountId" } } },
        "data": { "obj": { "balance": { "ref": "$.account.balance" } } },
        "as": "updated"
      },
      { "kind": "emitEvent", "event": "transfer.completed", "payload": { "ref": "$.updated" } },
      { "kind": "return", "value": { "ref": "$.updated" } }
    ],
    "else": [
      { "kind": "assert", "condition": { "lit": false }, "message": "Insufficient funds" }
    ]
  }
]
```

---

## Relation to Expr DSL

Every field annotated `Expr` above is a typed JSON AST node:

| Form   | Shape                                       | Example                                   |
|--------|---------------------------------------------|-------------------------------------------|
| `lit`  | `{ "lit": <string\|number\|boolean\|null> }` | `{ "lit": 42 }`                           |
| `ref`  | `{ "ref": "<root>.<path>" }`               | `{ "ref": "$.input.title" }`             |
| `call` | `{ "call": "<fn>", "args": Expr[] }`       | `{ "call": "lowercase", "args": [...] }` |
| `obj`  | `{ "obj": Record<string, Expr> }`          | `{ "obj": { "k": { "lit": 1 } } }`      |
| `arr`  | `{ "arr": Expr[] }`                        | `{ "arr": [{ "lit": 1 }] }`             |

Ref roots: `input`, `auth`, `record`, `records`, `system`, `env`,
`params`, `query`, plus any step alias (`as: "x"` → `$.x`).

---

## Static validation

### `validateOperationBody(steps, ctx)`

Source: `backend/src/lib/dsl/operation-validate.ts`

```ts
type OperationValidateCtx = {
  entityNames: string[];
  policyNames: string[];
  integrationNames: string[];
  eventNames?: string[];       // if absent, emitEvent.event is not checked
  expectedReturn?: boolean;    // if true, at least one return must exist
}
```

Checks performed:
- Zod parse of every step.
- `read.entity` and `mutate.entity` must be in `entityNames`.
- `authorize.policy` must be in `policyNames`.
- `callIntegration.integration` must be in `integrationNames`.
- `emitEvent.event` must be in `eventNames` (if provided).
- `mutate op:"create"` requires `data`. `mutate op:"update"` requires `data` + `where`. `mutate op:"delete"` requires `where`.
- All `as` identifiers must match `/^[a-z][a-zA-Z0-9_]*$/`.
- All `Expr` fields validated with `validateExpr`, accumulating step aliases.
- If `expectedReturn` is true: at least one top-level `return` step OR the last step is a `branch` with both `then` and `else` containing a `return`.

Returns `{ ok: boolean; errors: { path, code, message }[] }`.

### Static analysis (`operation-analyze.ts`)

- `collectOperationReads(body)` — entity names from `read` steps (unique, sorted)
- `collectOperationWrites(body)` — entity names from `mutate` steps (unique, sorted)
- `collectOperationEntities(body)` — union of reads + writes (unique, sorted)
- `collectOperationPolicies(body)` — policy names from `authorize` steps
- `collectOperationIntegrations(body)` — integration keys from `callIntegration` steps
- `collectOperationEvents(body)` — event names from `emitEvent` steps

All functions recurse into `branch.then` and `branch.else`.

---

## MCP tools

| Tool                              | Description                                          |
|-----------------------------------|------------------------------------------------------|
| `dtfs__validate_operation_body`   | Validate steps[] against project context from DB.    |
| `dtfs__analyze_operation_body`    | Extract entities/policies/integrations/events.       |
| `dtfs__validate_policy_rule`      | Validate a PolicyRule tree.                          |
| `dtfs__list_operation_step_kinds` | List all 10 step kinds with descriptions.            |
| `dtfs__list_policy_rule_ops`      | List all 12 PolicyRule operators.                    |

## HTTP endpoints

```
GET  /api/projects/:id/operation-dsl/step-kinds      → { kinds }
GET  /api/projects/:id/operation-dsl/policy-ops      → { ops }
POST /api/projects/:id/operation-dsl/validate-body   { steps, expectedReturn? }  → { ok, errors }
POST /api/projects/:id/operation-dsl/analyze-body    { steps }  → { reads, writes, integrations, events, policies }
POST /api/projects/:id/operation-dsl/validate-policy { rule }   → { ok, errors }
```
