# DeltaSpec — Canonical Format

A `DeltaSpec` is the **only authorised format** for modifying the Control Plane.
Every agent must produce a DeltaSpec, pass it through `validate_spec`, then
call `apply_spec` — which materialises it as a `ChangeSet`.

```
DeltaSpec → validate_spec → apply_spec → ChangeSet
```

DeltaSpec is **never stored as-is**. The platform applies it through normal
CRUD endpoints, each emitting a Revision linked to the active ChangeSet.

---

## Type definition

```typescript
type DeltaBlock<Create, Update, Ref> = {
  create?: Create[]
  update?: Update[]
  delete?: Ref[]
}

type DeltaSpec = {
  // Layer 1-2 — Product understanding
  productSpecs?:  DeltaBlock<ProductSpecInput,  ProductSpecPatch,  { id: string }>
  screenSpecs?:   DeltaBlock<ScreenSpecInput,   ScreenSpecPatch,   { id: string }>
  requirements?:  DeltaBlock<RequirementInput,  RequirementPatch,  { id: string }>

  // Layer 6 — Data model
  entities?:      DeltaBlock<EntityInput,       EntityPatch,       { id: string }>
  attributes?:    DeltaBlock<AttributeInput,    AttributePatch,    { id: string }>
  relations?:     DeltaBlock<RelationInput,     RelationPatch,     { id: string }>
  resources?:     DeltaBlock<ResourceInput,     ResourcePatch,     { id: string }>
  operations?:    DeltaBlock<OperationInput,    OperationPatch,    { id: string }>
  policies?:      DeltaBlock<PolicyInput,       PolicyPatch,       { id: string }>
  workflows?:     DeltaBlock<WorkflowInput,     WorkflowPatch,     { id: string }>
  triggers?:      DeltaBlock<TriggerInput,      TriggerPatch,      { id: string }>
  integrations?:  DeltaBlock<IntegrationInput,  IntegrationPatch,  { id: string }>
  assets?:        DeltaBlock<AssetInput,        AssetPatch,        { id: string }>
  authMethods?:   DeltaBlock<AuthMethodInput,   AuthMethodPatch,   { id: string }>

  // Layer 5 — UI
  screens?:       DeltaBlock<ScreenInput,       ScreenPatch,       { id: string }>
  components?:    DeltaBlock<ComponentInput,    ComponentPatch,    { id: string }>
  forms?:         DeltaBlock<FormInput,         FormPatch,         { id: string }>
  fields?:        DeltaBlock<FieldInput,        FieldPatch,        { id: string }>
  actions?:       DeltaBlock<ActionInput,       ActionPatch,       { id: string }>
  dataBindings?:  DeltaBlock<DataBindingInput,  DataBindingPatch,  { id: string }>

  // Layer 10 — Test
  testScenarios?: DeltaBlock<TestScenarioInput, TestScenarioPatch, { id: string }>
}
```

The canonical Zod schema is exported from
`backend/src/lib/dsl/delta-spec.ts` as `deltaSpecSchema`.

---

## Relation to PlatformSpecProposal

A `PlatformSpecProposal` (Phase 6) is the **human-reviewed synthesis** of what
the Control Plane should look like for a feature. Once ACCEPTED, it is compiled
into a DeltaSpec via:

```
compileProposalToDelta(proposal.proposal) → DeltaSpec
```

The compiler (`backend/src/lib/delta-spec-compile.ts`) maps each bucket of the
proposal into the matching DeltaSpec bucket, using `name`-based cross-refs
(e.g. `entityName: "Contact"` instead of `entityId`). Id resolution happens
during the apply step, not during compilation.

### Lifecycle

```
ProposalContents (DRAFT → ACCEPTED)
  → compileProposalToDelta()
  → DeltaSpec
  → validateDeltaSpec()       # static lint, no DB write
  → applyDeltaSpec()          # DB writes, emits ChangeSet   (Phase 8)
  → ChangeSet (APPLIED)
```

---

## Name-based cross-refs

Within a single DeltaSpec, entities and operations can be referenced by name
instead of by database id:

- `attributes.create[].entityName: "Contact"`
- `relations.create[].fromEntityName: "Order"`, `.toEntityName: "User"`
- `resources.create[].entityName: "Contact"`
- `policies.create[].entityName: "Contact"`
- `triggers.create[].operationName: "createOrder"`

The apply step resolves these names against both the existing DB rows and the
`create` arrays within the same DeltaSpec (in dependency order).

---

## API endpoints

All endpoints are under `/api/projects/:id/delta-spec`.

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/from-proposal` | `{ proposalId }` | `{ deltaSpec }` |
| POST | `/validate` | `{ deltaSpec }` | `{ ok, errors[] }` |
| POST | `/explain` | `{ deltaSpec }` | `{ markdown }` |

### MCP tools

| Tool | Input | Output |
|------|-------|--------|
| `dtfs__create_delta_from_platform_proposal` | `{ projectId, proposalId }` | `{ deltaSpec }` |
| `dtfs__validate_delta_spec` | `{ projectId, deltaSpec }` | `{ ok, errors[] }` |
| `dtfs__explain_delta_spec` | `{ projectId, deltaSpec }` | `{ markdown }` |

---

## Validation rules

`validateDeltaSpec(deltaSpec, ctx)` runs static (no-DB-write) checks:

1. Zod schema parse against `deltaSpecSchema`.
2. `attributes.create[].entityName` must resolve to an existing entity or a
   create in the same spec.
3. `relations.create[]` `fromEntityName` / `toEntityName` — same rule.
4. `resources.create[].entityName` — same rule.
5. `policies.create[].entityName` — same rule.
6. `operations.create[].reads[]` and `.writes[]` — entity names must resolve.
7. `triggers.create[].operationName` must resolve to an existing operation or a
   create in the same spec.

`ctx` carries `existingEntityNames: Set<string>` and
`existingOperationNames: Set<string>` (loaded from DB by the caller).

---

## Apply order

Mutations are applied in dependency order:

1. ProductSpecs, ScreenSpecs, Requirements (no deps)
2. Entities
3. Attributes (need Entity)
4. Relations (need 2 × Entity)
5. Policies (may reference Entity)
6. Integrations
7. Operations (need Policy + Integration)
8. Resources (need Entity + Policy)
9. Triggers (need Operation)
10. Workflows, AuthMethods, Assets
11. Screens, Components, Forms, Fields, Actions, DataBindings
12. TestScenarios

Updates run after creates. Deletes run last (cascade order reversed).

---

## Example — Todo-list feature

```jsonc
{
  "entities": {
    "create": [
      { "name": "TodoList" },
      { "name": "TodoItem" }
    ]
  },
  "attributes": {
    "create": [
      { "entityName": "TodoList", "name": "title",  "type": "TEXT", "required": true },
      { "entityName": "TodoItem", "name": "content", "type": "TEXTAREA" },
      { "entityName": "TodoItem", "name": "done",    "type": "CHECKBOX" }
    ]
  },
  "relations": {
    "create": [
      {
        "fromEntityName": "TodoItem",
        "toEntityName": "TodoList",
        "name": "list",
        "kind": "ONE_TO_MANY",
        "required": true
      }
    ]
  },
  "operations": {
    "create": [
      {
        "name": "createTodoList",
        "kind": "COMMAND",
        "inputSchema": { "type": "object", "required": ["title"], "properties": { "title": { "type": "string" } } },
        "reads": [],
        "writes": ["TodoList"],
        "steps": [
          { "kind": "authorize", "policy": "authenticated-only" },
          { "kind": "mutate", "op": "create", "entity": "TodoList", "data": "$.input", "as": "list" },
          { "kind": "return", "value": "$.list" }
        ]
      }
    ]
  },
  "screens": {
    "create": [
      { "path": "/todo-lists", "type": "web" }
    ]
  }
}
```

---

## What DeltaSpec does NOT contain

- **No code** — Step DSL describes intent, not source code.
- **No DB DDL** — codegen (Phase 9) produces actual DDL.
- **No secrets** — `secretRefs` only point to env vars / vault paths.
- **No file contents** — Asset uploads go through dedicated endpoints.
