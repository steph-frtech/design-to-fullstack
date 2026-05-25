# Execution Flow

A concrete walk through of how a user's idea becomes a deployable app.

## Scenario

> "I want a multi-user todo app where users can share lists by link."

This document traces that sentence through all 10 layers.

## Layer 0 — Natural Input

The user provides:
- Free prose ("I want a multi-user todo app…")
- Optionally: HTML mockups (`client.html`), Figma exports, sketches
- Optionally: references to an existing project

Nothing is stored persistently at this layer — it's just the request body
sent to the platform.

## Layer 1 — Product Understanding

An LLM (likely the `dtfs-product-analyst` agent — Phase 1 work) extracts:

```jsonc
ProductSpec {
  name: "todo-list-multi-user",
  data: {
    purpose: "Personal task management with social sharing",
    personas: [
      { name: "Solo planner", goals: ["track personal todos"] },
      { name: "Family organizer", goals: ["share grocery list"] }
    ],
    goals: [
      { kind: "USER", title: "Add a todo in under 3 seconds" },
      { kind: "BUSINESS", title: "Acquire users via shared-link virality" }
    ],
    glossary: [
      { term: "TodoList", definition: "A named collection of items" },
      { term: "ShareLink", definition: "A token-based URL granting read access" }
    ]
  }
}
```

## Layer 2 — Screen Understanding

For each screen mentioned (or each HTML provided), a `ScreenSpec` is
extracted:

```jsonc
ScreenSpec {
  name: "TodoListsIndex",
  data: {
    fields: [],
    actions: [
      { kind: "navigate", to: "/lists/:id" },
      { kind: "open-modal", target: "new-todo-list-form" }
    ],
    dataNeeds: ["currentUser's todo-lists, sorted by recency"],
    states: ["empty", "loading", "ready"]
  }
}
```

## Layer 3 — Clarification

The platform surfaces ambiguities as `OpenQuestion` rows:

```jsonc
OpenQuestion {
  target: { kind: "feature", topic: "share-link expiration" },
  prompt: "Should share links expire? If so, default duration?",
  status: "OPEN"
}
```

Until answered, the platform writes `Assumption` rows for any decision
forced by silence:

```jsonc
Assumption {
  scope: { kind: "ShareLink" },
  statement: "ShareLinks never expire by default; users can revoke.",
  confidence: "MEDIUM",
  kind: "PRODUCT"
}
```

## Layer 4 — Spec Kit

A Spec Kit flow materializes four `SpecArtifact` documents:

- `CONSTITUTION` — principles (e.g., "no email required to share")
- `SPEC` — functional spec (the markdown the user reviews)
- `PLAN` — technical plan
- `TASKS` — ordered task list for downstream layers

These are inspectable Markdown — they're the contract the LLM commits to.

## Layer 5 — Platform Mapping

Each `Requirement` from the spec is mapped to one or more Control Plane
concepts:

```jsonc
Requirement {
  statement: "Users can create todo lists",
  kind: "FUNCTIONAL"
}

RequirementMapping {
  requirementId: "req_…",
  targetType: "Operation",
  targetId: "op_createTodoList"
}
RequirementMapping {
  requirementId: "req_…",
  targetType: "Resource",
  targetId: "res_todo-lists"
}
```

## Layer 6 — DeltaSpec

The mapping output is rendered as a JSON deltaSpec — a transactional
description of the changes to apply (see `DELTA_SPEC.md`):

```jsonc
{
  "creates": {
    "entities":     [ { name: "TodoList", attributes: [...] }, ... ],
    "resources":    [ { name: "todo-lists", entityId: "...", ... } ],
    "operations":   [ { name: "createTodoList", kind: "COMMAND", ... } ],
    "policies":     [ { name: "is-todo-list-owner", scope: "ENTITY", ... } ],
    "behaviors":    [ { entityId: "...", kind: "ownable" } ]
  },
  "updates": {},
  "deletes": {}
}
```

## Layer 7 — Validation

Before applying, the deltaSpec is linted: every Step references known
Entities, every Policy rule parses against the DSL, every Behavior is in
the catalogue, every JSONata expression is valid (see `EXPR_DSL.md`).

Endpoint: `POST /api/projects/:id/spec/validate`.

## Layer 8 — ChangeSet

A ChangeSet is opened with a meaningful message:

```
POST /api/projects/:id/changesets { "message": "Add todo-list feature" }
```

The deltaSpec is applied via the per-concept CRUD endpoints, with the
`X-ChangeSet-Id` header set. Every mutation produces a Revision linked to
the ChangeSet. Then:

```
POST /api/projects/:id/changesets/:csid/commit
```

If something goes wrong, the user (or LLM) can revert the entire
ChangeSet in one call.

## Layer 9 — Codegen (V3)

The Control Plane state is compiled into real code:

```
GeneratedArtifact { path: "backend/prisma/schema.prisma", content: "..." }
GeneratedArtifact { path: "backend/src/routes/todo-lists.ts", content: "..." }
GeneratedArtifact { path: "frontend/web/src/app/lists/page.tsx", content: "..." }
...
```

The generated code targets the V3 stack (DoltPostgres + Hono + Prisma +
Next + Temporal).

## Layer 10 — Test & Audit

For each Operation, declarative `TestScenario` rows guide downstream
codegen of unit / integration / e2e tests:

```jsonc
TestScenario {
  operationId: "op_createTodoList",
  name: "happy-path",
  inputs: { title: "Groceries" },
  expected: { ok: true, fields: ["id", "title"] },
  mocks: {}
}
```

`AuditLog` captures runtime events (apply_spec, codegen.run, deploy).

## Layer 9 — Contracts (Phase 25-28 target)

Before emitting code, the platform compiles three intermediate contracts from the ProjectSpec:

```
ProjectSpec (stable after ChangeSet commit)
  │
  ├─ RuntimeTarget         "hono-next" — Hono ~4.12 + Next 16 + Better Auth
  │
  ├─ compileBackendContract()
  │    reads: Entity, Resource, Operation, Policy, AuthMethod, Asset, EventDefinition
  │    writes: BackendContract { apiBasePath, routes[], schemas[], middlewares[], auth, errors }
  │
  ├─ compileFrontendContract()
  │    reads: Screen, Component, Form, Field, Action, DataBinding, Policy, Translation, Theme
  │    writes: FrontendContract { routes[], pages[], components[], forms[], dataBindings[], actions[], authGuards[] }
  │
  ├─ compileSharedContract()
  │    reads: BackendContract + FrontendContract
  │    writes: SharedContract { types[], schemas[], apiClient[], errors, events[] }
  │
  └─ validateContracts()    ← gate: must pass before any file is written
```

Each contract is a DB row (not ephemeral) — inspectable by agents, diffable across versions,
regeneratable selectively if only one layer changes.

**Then emitters read contracts, not the Control Plane:**

```
BackendContract   → emit-hono.ts         → apps/api/src/routes/*.ts
                  → emit-better-auth.ts  → apps/api/src/auth.ts
                  → emit-prisma.ts       → prisma/schema.prisma
FrontendContract  → emit-next.ts         → apps/web/app/**/*.tsx
SharedContract    → emit-shared-sdk.ts   → packages/shared/src/**
```

Every emitted file is recorded as a `GeneratedArtifact` row with `contentHash`, `protected` flag,
and a link back to the contract it came from. See `GENERATED_ARTIFACTS.md`.

## Full Chain (Natural → Generated App)

```
Natural description + HTML/Figma
  → ProductSpec (Layer 1)
  → ScreenSpec (Layer 2)
  → Clarification — OpenQuestion / Assumption (Layer 3)
  → SpecArtifact — constitution / spec / plan (Layer 4)
  → Requirement → RequirementMapping (Layer 5)
  → DeltaSpec (Layer 6)
  → validate_spec / governance_checks (Layer 7)
  → ChangeSet.commit → ProjectSpec (Layer 8)
  → RuntimeTarget
  → BackendContract + FrontendContract + SharedContract
  → validateContracts()
  → GeneratedArtifact rows + files on disk (Layer 9)
  → TestScenario → test files + AuditLog (Layer 10)
```

## Reverse flow

The pipeline runs forward to materialize an app, but **every layer is
versioned**. To "go back to before billing":

1. `dtfs__list_history(projectId)` — list ChangeSets
2. find the one whose message contains "billing"
3. `dtfs__revert_changeset(csid)` — inverse operation produces a new
   APPLIED ChangeSet
4. (downstream layers auto-recompute on next codegen)
