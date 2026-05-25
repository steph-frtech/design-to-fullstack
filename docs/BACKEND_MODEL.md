# Backend Model — Control Plane V1

This is the canonical reference for the **dtfs** Control Plane vocabulary —
the set of concepts an LLM (or a human) uses to describe a full-stack app
declaratively. Read this once; everything else (MCP tools, HTTP endpoints,
codegen) flows from these definitions.

## Mental model

```
Entity        — shape of data
EntityRelation— asymmetric link between Entities (FK + cascade)
Resource      — CRUD-style API exposure of an Entity
Operation     — explicit backend verb (QUERY | COMMAND), with typed I/O + steps
Policy        — authorization rule (compiles to middleware + Prisma where)
Integration   — named external service (Stripe, SendGrid, S3, OpenAI…)
Trigger       — non-human cause that fires an Operation (EVENT|SCHEDULE|WEBHOOK)
Behavior      — composable macro on an Entity (ownable, soft-deletable, …)
ChangeSet     — git-commit-style grouping of Revisions for revert
Revision      — atomic per-row snapshot + diff (auto-emitted on every mutation)
```

The structuring sentence:

> An **Entity** describes the data.
> A **Resource** describes how that data is exposed.
> An **Operation** describes what the system can do.
> A **Policy** describes who can do it.
> A **Trigger** describes when it fires (non-human).
> An **Integration** describes what the system talks to.
> A **Behavior** is a declarative macro that expands into the above.

## Two-plane architecture

```
┌──────────────────────────────────────────────┐
│   Control Plane  (this — schema dtfs)        │
│                                              │
│   Stores DEFINITIONS — Project, Entity, …    │
│   Versioned via ChangeSet / Revision.        │
└──────────────────────────────────────────────┘
                  │
                  │  compile()  ← V3 codegen
                  ▼
┌──────────────────────────────────────────────┐
│   Generated App N   (V3, schema gen_<slug>)  │
│                                              │
│   Real Postgres tables, FK, RLS              │
│   Real Hono API, Prisma client, Next pages   │
│   Real cron jobs, webhooks, integrations     │
│                                              │
│   V3 target stack:                           │
│     • DoltPostgres (branches, time-travel)   │
│     • Temporal (Operation kind=WORKFLOW)     │
└──────────────────────────────────────────────┘
```

V1 only touches the Control Plane.

## Concepts in detail

### Entity + Attribute

The shape of a domain object. Doesn't expose anything by itself.

```
Entity { name }
Attribute { name, type ∈ {TEXT, EMAIL, NUMBER, CHECKBOX, SELECT, …}, required, unique, config(JSON) }
```

The default seed entity has `name`, `email` (unique), `category` (SELECT), etc.

### EntityRelation

Asymmetric — one side carries the FK. Drives joins, cascade, and (V3) actual SQL FK generation.

```
EntityRelation {
  fromEntityId  // carries the FK
  toEntityId
  kind: ONE_TO_ONE | ONE_TO_MANY | MANY_TO_MANY
  fromField     // e.g. "listId" on TodoItem
  toField       // default "id"
  cascade       // { onDelete: "CASCADE" | "SET_NULL" | "RESTRICT" }
}
```

### Resource

Maps an Entity to an HTTP CRUD surface. **0 or 1 Resource per Entity** (private vs public).

```
Resource {
  entityId
  name           // plural kebab-case, e.g. "todo-lists"
  exposedOps     // subset of ["list", "read", "create", "update", "delete"]
  queryConfig    // QueryConfig — see below
  defaultPolicyId // applied to all ops unless overridden
}
```

`QueryConfig` is strictly typed:
```ts
{
  pagination?: { kind: "offset"|"cursor"; default: number; max: number }
  sort?:       { allowed: string[]; default?: string[] }
  filter?:     { field: string; operators: ("eq"|"in"|"contains"|"gt"|"gte"|"lt"|"lte")[] }[]
  search?:     { fields: string[]; mode: "ilike"|"fulltext"|"external" }
}
```

### Operation

THE concept that makes vibe-coding deterministic. Backend verb with typed
I/O and a **Step DSL** body — no free-form code.

```
Operation {
  name           // camelCase, e.g. "createTodoList"
  kind: QUERY | COMMAND     // V1 — sync. WORKFLOW reserved for V3 (Temporal).
  inputSchema    // JSON Schema
  outputSchema   // JSON Schema (optional for COMMAND, required for QUERY)
  reads          // string[] of entity names read
  writes         // string[] of entity names written
  steps          // OperationStep[]  — the Step DSL
  bodyHint       // free prose; informative only, never interpreted
}
```

The Step DSL — typed kinds:
```ts
type OperationStep =
  | { kind: "validate";  schema: JsonSchema }
  | { kind: "authorize"; policy: string }                                   // by name
  | { kind: "read";      entity: string; where: Expr; as: string }
  | { kind: "mutate";    op: "create"|"update"|"delete"|"upsert";
                          entity: string; data?: Expr; where?: Expr; as?: string }
  | { kind: "callIntegration"; integration: string; capability: string; input: Expr; as?: string }
  | { kind: "emitEvent"; event: string; payload: Expr }
  | { kind: "branch";    if: Expr; then: OperationStep[]; else?: OperationStep[] }
  | { kind: "return";    value: Expr };
```

`Expr` is a **JSONata** expression string. Reachable roots:
- `$.input`      — Operation input
- `$.auth.user`  — authenticated user object
- `$.record`     — current record (in policies scoped ENTITY)
- `$.system`     — helpers: `$.system.now`, `$.system.randomToken`
- `$.env`        — exposed env vars
- variables `as: "..."` accumulated by earlier steps

### Policy

Authorization. Compilable to three targets:
1. **Hono middleware** — evaluated before invoking an Operation
2. **Prisma where-clause** — injected on Resource list/read
3. **Postgres RLS DDL** — V2 — defense in depth

```
Policy {
  name
  scope: RESOURCE | OPERATION | ENTITY | FIELD
  resourceId?
  operationId?
  entityId?
  fieldName?    // for scope=FIELD
  effect: ALLOW | DENY
  rule          // PolicyRule
}
```

The Policy DSL — a JSON expression tree, no free JS:
```ts
type PolicyRule =
  | { all: PolicyRule[] } | { any: PolicyRule[] } | { not: PolicyRule }
  | { eq:  [Expr, Expr] }      | { neq: [Expr, Expr] }
  | { in:  [Expr, Expr[]] }
  | { gt:  [Expr, Expr] }      | { gte: [Expr, Expr] }
  | { lt:  [Expr, Expr] }      | { lte: [Expr, Expr] }
  | { exists: Expr }
  | { matches: [Expr, string /* regex */] };
```

Example: `eq($.record.ownerId, $.auth.user.id)` — owner check.

### Integration

Named connection to an external service. **Secrets do NOT live here** —
`secretRefs` points to env vars or a secret store.

```
Integration {
  key            // local name, e.g. "email"
  provider       // technical, e.g. "sendgrid"
  capabilities   // verbs exposed, e.g. ["email.send"]
  configSchema   // provider-specific
  secretRefs     // { apiKey: "env:SENDGRID_API_KEY" }
}
```

`Operation.steps[].callIntegration` references `integration` by key + `capability`
(must be in the catalogue declared on the Integration).

### Trigger

Non-human cause. UI form submits don't go through Trigger — they reference
the Operation directly via `Form.operationId`.

```
Trigger {
  name
  kind: EVENT | SCHEDULE | WEBHOOK
  source:
    EVENT    → { event: "order.paid" }
    SCHEDULE → { cron: "0 0 * * *" }
    WEBHOOK  → { path: "/webhooks/stripe", method: "POST", verify?: "stripe-signature" }
  operationId
  inputMapping    // JSONata mapping from source → Operation input
}
```

V3 runtime: SCHEDULE + WEBHOOK go through Temporal.

### Behavior

Composable macro. **Must always expand to visible Resources/Operations/Policies
before codegen** — call `POST /api/projects/:id/expand-behaviors` for the preview.

```
Behavior {
  entityId
  kind          // FROZEN catalogue (see /api/behaviors)
  config        // shape per kind
}
```

V1 catalogue:
- `ownable` — adds `ownerId`, policy `eq($.record.ownerId, $.auth.user.id)`
- `soft-deletable` — adds `deletedAt?`, filters in lists, `restore` Operation
- `publishable` — adds `status` + `publishedAt`, publish/unpublish/archive Operations
- `taggable` — adds `tags: string[]` with `contains` filter
- `searchable` — declares `fields[]` for search Operation
- `shareable` — adds child Entity `<X>ShareLink` + `createShareLink` Operation

Behaviors are **declarative sugar** — the source of truth is the expanded form.

## Versioning — ChangeSets and Revisions

Every mutation through the Prisma client passes through a versioning
extension that writes a `Revision` row (snapshot + per-field diff).

Revisions belong to a `ChangeSet` — the git-commit-style grouping:

```
ChangeSet {
  message
  status: DRAFT | APPLIED | REVERTED
  parentId       // for history graph (linear in V1)
  revertOfId     // if this CS is a revert of another
  revertedById   // if this CS has been reverted
}
```

How a ChangeSet is opened:
- **Explicit** — client sends `X-ChangeSet-Id: <csid>` header
- **Implicit** — backend auto-opens a one-revision CS for any write under
  `/api/projects/:id/*` without the header. Message: `auto: <Method> <Path>`.

Granularity:

| Level                | Mechanism                | Endpoint                              |
|----------------------|--------------------------|---------------------------------------|
| Field                | `Revision.diff[field]`   | `POST /api/revisions/:id/revert-field`|
| Revision (atomic)    | `Revision` row           | `POST /api/revisions/:id/revert`      |
| ChangeSet (logical)  | `ChangeSet` row          | `POST /api/projects/:id/changesets/:csid/revert` |

Reverts create a **new** APPLIED ChangeSet with inverse Revisions. The original
is marked REVERTED, with `revertedById` pointing to the new CS. Reverts of
reverts are allowed (redo).

## Exposing to LLMs

Three surfaces:

### HTTP endpoints

```
GET    /api/projects                            list
GET    /api/projects/:id                        single (rich include)
GET    /api/projects/:id/spec                   FULL nested spec JSON
GET    /api/projects/:id/spec.md                same as markdown (LLM-friendly)
POST   /api/projects/:id/spec/validate          lint a proposed deltaSpec
POST   /api/projects/:id/spec/expand-behaviors  preview Behavior expansion

# Per-concept CRUD (7 endpoints per concept)
GET/POST/PUT/DELETE /api/projects/:id/resources
GET/POST/PUT/DELETE /api/projects/:id/operations
GET/POST/PUT/DELETE /api/projects/:id/policies
GET/POST/PUT/DELETE /api/projects/:id/integrations
GET/POST/PUT/DELETE /api/projects/:id/triggers
GET/POST/PUT/DELETE /api/projects/:id/behaviors
GET/POST/PUT/DELETE /api/projects/:id/relations

# History
GET    /api/projects/:id/changesets             list
GET    /api/projects/:id/changesets/:csid       detail + revisions
POST   /api/projects/:id/changesets             open DRAFT
POST   /api/projects/:id/changesets/:csid/commit
DELETE /api/projects/:id/changesets/:csid       discard (DRAFT only)
POST   /api/projects/:id/changesets/:csid/revert
POST   /api/revisions/:rid/revert               atomic revert
POST   /api/revisions/:rid/revert-field         ultra-fine revert

# Catalogues
GET    /api/behaviors                           Behavior catalogue
```

### MCP tools

The MCP server (`backend/src/mcp.ts`) wraps the same operations as named tools:

```
dtfs__list_projects
dtfs__get_project_spec(projectId, format: "json"|"md")
dtfs__describe_concept(concept)
dtfs__list_behaviors
dtfs__expand_behaviors(projectId)
dtfs__validate_spec(projectId, deltaSpec)
dtfs__begin_changeset(projectId, message)
dtfs__commit_changeset(changeSetId)
dtfs__discard_changeset(changeSetId)
dtfs__revert_changeset(changeSetId)
dtfs__list_history(projectId, limit?)
dtfs__describe_changeset(changeSetId)
dtfs__revert_revision(revisionId)
dtfs__revert_field(revisionId, field)
```

### Markdown spec (for prompts)

`GET /api/projects/:id/spec.md` produces a structured markdown document with
sections per concept, ready to paste into an LLM prompt. It's compact (fits in
a context window for small projects) and lossless for the concept-level
information that matters for codegen.

## Invariants

Cross-model rules the LLM must respect when producing or modifying a spec:

- **Form.operationId** must point to an Operation in the same Project.
- **Trigger.operationId** must point to an Operation in the same Project,
  kind ∈ {QUERY, COMMAND} (WORKFLOW reserved).
- **Resource.entityId** must point to an Entity in the same Project.
- **Resource.defaultPolicyId** must point to a Policy in the same Project.
- **Behavior.kind** must be in the V1 frozen catalogue.
- **Step.entity** in `read` / `mutate` must be a known Entity name in the Project.
- **Step.policy** in `authorize` must be a known Policy name in the Project.
- **Step.integration** in `callIntegration` must be a known Integration key,
  and `step.capability` must appear in that Integration's capabilities array.
- **Policy.scope=ENTITY** requires `entityId`; **scope=RESOURCE** requires
  `resourceId`; etc.
- **EntityRelation.fromEntityId** and `toEntityId` must both be Entities of the
  same Project.

The `POST /spec/validate` endpoint enforces most of these statically.

## Complete example — `todo-list-multi-user`

Run `pnpm --filter backend seed:todo` to materialize this in your DB. The
seed creates ONE ChangeSet `seed: todo-list-multi-user` grouping 21 Revisions:

| Concept        | Count | Names                                                       |
|----------------|-------|-------------------------------------------------------------|
| Entity         | 3     | TodoList, TodoItem, ShareLink                               |
| Attribute      | 7     | (across the three entities)                                 |
| EntityRelation | 2     | TodoItem→TodoList, ShareLink→TodoList (ONE_TO_MANY)         |
| Resource       | 2     | `todo-lists`, `todo-items`                                  |
| Operation      | 4     | createTodoList, createTodoItem, toggleTodoItem, createShareLink |
| Policy         | 2     | `authenticated-only` (OPERATION), `is-todo-list-owner` (ENTITY) |
| Behavior       | 1     | `ownable` on TodoList                                       |

Inspect via:
```bash
curl http://localhost:4002/api/projects/<id>/spec.md
```

## Workflow — modify a spec from an LLM

The recommended dance:

```
1. dtfs__get_project_spec(projectId, "md")             # read current state
2. (LLM proposes a deltaSpec — operations / policies)
3. dtfs__validate_spec(projectId, deltaSpec)           # static lint
4. (if errors, iterate)
5. dtfs__begin_changeset(projectId, "feature: …")      # open DRAFT
6. Apply mutations via per-concept HTTP endpoints
   (each emits a Revision linked to the DRAFT)
7. dtfs__commit_changeset(csid)                        # seal as APPLIED
```

Reverting is symmetric:
```
dtfs__list_history(projectId)
dtfs__describe_changeset(csid)
dtfs__revert_changeset(csid)         # whole CS
dtfs__revert_revision(revisionId)    # atomic
dtfs__revert_field(revisionId, "title")  # ultra-fine
```

## Out of scope (V1)

- Codegen of full-stack apps (V3)
- `Operation.kind = WORKFLOW` runtime (V3, via Temporal)
- Asset / FileObject (storage)
- SearchIndex (Algolia / Meili / fulltext-extra)
- Subscription / realtime
- Branched history (CheckOut, Merge) — linear only
- RLS DDL compilation — only middleware + Prisma where in V1
- Asset / AuthMethod / Expr-as-AST — deferred to V1.x (cf. brainstorm)
