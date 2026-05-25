# Behaviors — DeltaSpec Expansion

A **Behavior** is a high-level macro attached to an Entity. When expanded, it
produces a canonical **DeltaSpec** (Phase 7) containing Attributes, Relations,
Operations, Policies, and TestScenarios. Expansion is always **dry-run** — no
DB write happens until the resulting DeltaSpec is explicitly applied via
`dtfs__apply_delta_spec` or `POST /:id/apply`.

---

## Expansion table (V1)

| Behavior | Attributes | Relations | Operations | Policies | TestScenarios | Status |
|---|---|---|---|---|---|---|
| `ownable` | `ownerId` (TEXT, rel User) | — | `list<E>ForOwner` | `<E>OwnerOnly` (ENTITY, eq record.ownerId / auth.user.id) | 2 | V1 |
| `soft-deletable` | `deletedAt` (DATETIME?) | — | `restore<E>` | `<E>NotDeleted` | 3 | V1 |
| `publishable` | `status` (TEXT, enum), `publishedAt` (DATETIME?) | — | `publish<E>`, `unpublish<E>`, `archive<E>` | `<E>PublishedOnly` | 3 | V1 |
| `taggable` | `tags` (TEXT[]) | — | — | — | 2 | V1 |
| `searchable` | — | — | `search<E>` (q: string) | — | 2 | V1 |
| `shareable` | — | `<E>` → `<E>ShareLink` (ONE_TO_MANY) | `createShareLinkFor<E>` | — | 1 | V1 |
| `auditable` | — | — | `list<E>AuditLog` | — | 2 | V1 (write hook V2) |
| `versioned` | `version` (NUMBER, default 1) | — | — | — | 2 | V1 |
| `commentable` | — | `<E>` → `Comment` (ONE_TO_MANY) | `addCommentTo<E>`, `list<E>Comments` | — | 2 | V1 |
| `attachable` | — | `<E>` → `Asset` (ONE_TO_MANY) | `attachFileTo<E>`, `list<E>Attachments` | — | 2 | V1 |
| `localizable` | `<field>Key` per translatable field | — | — | — | 1 per field | V1 |

> `<E>` = entity name (e.g. `Ticket`). Field names are configurable — see
> each behavior's config schema.

---

## Example: `Ticket` + `ownable` → DeltaSpec

```json
{
  "attributes": {
    "create": [
      {
        "entityName": "Ticket",
        "name": "ownerId",
        "type": "TEXT",
        "required": true,
        "config": { "relation": "User", "relationField": "id" }
      }
    ]
  },
  "policies": {
    "create": [
      {
        "name": "TicketOwnerOnly",
        "scope": "ENTITY",
        "entityName": "Ticket",
        "effect": "ALLOW",
        "rule": { "eq": [{ "ref": "record.ownerId" }, { "ref": "auth.user.id" }] }
      }
    ]
  },
  "operations": {
    "create": [
      {
        "name": "listTicketForOwner",
        "kind": "QUERY",
        "inputSchema": {},
        "reads": ["Ticket"],
        "writes": [],
        "steps": [
          { "kind": "authorize", "policy": "TicketOwnerOnly" },
          { "kind": "read", "entity": "Ticket", "many": true, "as": "items",
            "where": { "eq": [{ "ref": "record.ownerId" }, { "ref": "auth.user.id" }] } },
          { "kind": "return", "value": { "ref": "items" } }
        ]
      }
    ]
  },
  "testScenarios": {
    "create": [
      { "name": "Ticket owner can read their own records", "operationName": "listTicketForOwner", "expected": { "statusCode": 200 } },
      { "name": "Ticket non-owner is denied", "expected": { "statusCode": 403 } }
    ]
  }
}
```

---

## HTTP API

### Dry-run preview (V1 text format)
```
POST /api/projects/:id/spec/expand-behaviors
```
Returns `{ expansion: [{ entity, behavior, config, adds }] }`.

### Dry-run DeltaSpec (Phase 7, **canonical**)
```
POST /api/projects/:id/spec/expand-behaviors/delta
Content-Type: application/json

{
  "entities": [
    { "name": "Contact", "behaviors": ["ownable", "soft-deletable"] }
  ]
}
```
Returns `{ deltaSpec, perBehavior }`.

Omit `entities` to use the behaviors already stored for the project.

---

## MCP Tools

| Tool | Description |
|---|---|
| `dtfs__list_behaviors` | Return the catalogue of all 11 behaviors |
| `dtfs__expand_behaviors` | V1 preview OR DeltaSpec (pass `asDelta:true` or `entities`) |
| `dtfs__expand_behaviors_to_delta` | Always returns DeltaSpec — explicit, recommended |

### `dtfs__expand_behaviors_to_delta` example
```json
{
  "projectId": "...",
  "entities": [
    { "name": "Ticket", "behaviors": ["ownable", "commentable"] }
  ]
}
```

---

## Behavior configs

| Behavior | Config fields | Defaults |
|---|---|---|
| `ownable` | `ownerField` | `"ownerId"` |
| `soft-deletable` | `field` | `"deletedAt"` |
| `publishable` | `statusField`, `publishedAtField` | `"status"`, `"publishedAt"` |
| `taggable` | `field` | `"tags"` |
| `searchable` | `fields` (required), `mode` | — / `"ilike"` |
| `shareable` | `linkEntityName`, `tokenField` | `"<E>ShareLink"`, `"token"` |
| `auditable` | `trackFields` | all fields |
| `versioned` | `versionField` | `"version"` |
| `commentable` | `commentEntityName`, `bodyField` | `"Comment"`, `"body"` |
| `attachable` | `assetEntityName` | `"Asset"` |
| `localizable` | `fields` (required) | — |

---

## V1 / V2 status

| Feature | V1 | V2 |
|---|---|---|
| DeltaSpec output (attributes, policies, operations) | All 11 behaviors | — |
| `auditable` mutation hook (auto write AuditLog on update) | Description only | Codegen hook |
| `searchable` fulltext / external | ilike only | fulltext / Meilisearch |
| `localizable` set-translation operation | — | `set<E>Translation` (COMMAND) |
| `shareable` public route gating | Operation only | Middleware codegen |

References: AuditLog, Asset, Comment are Phase 10 models — referenced by
name in the DeltaSpec, not inline-created by the expansion.
