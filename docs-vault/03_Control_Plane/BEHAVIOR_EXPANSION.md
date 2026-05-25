# Behavior Expansion

Un **Behavior** est une macro déclarative de haut niveau attachée à une Entity. Quand il est expansé, il produit un **DeltaSpec canonique** contenant des Attributes, Relations, Operations, Policies, et TestScenarios. L'expansion est toujours un **dry-run** — aucune écriture DB ne se produit tant que le DeltaSpec résultant n'est pas explicitement appliqué.

**Liens** : [[CONTROL_PLANE_MODEL]] · [[DELTA_SPEC]] · [[OPERATION_DSL]] · [[POLICY_DSL]]

## Source of truth

`docs/BEHAVIORS.md` · `backend/src/concepts/behaviors.ts` · `backend/prisma/schema.prisma` (modèle `Behavior`)

## AI usage

Toujours expanser les Behaviors avant le codegen via `dtfs__expand_behaviors_to_delta`. Ne jamais inliner la logique d'un Behavior manuellement — utiliser le chemin canonique expansion → DeltaSpec → validate → apply. Le catalogue est fermé en V1 : tout `kind` hors catalogue sera rejeté.

## Status

V1 — 11 behaviors, expansion DeltaSpec disponible. Les hooks write-time pour `auditable` arrivent en V2. `searchable` fulltext/external = V2.

---

## Table d'expansion V1

| Behavior | Attributes générés | Relations | Operations | Policies | TestScenarios | Status |
|---|---|---|---|---|---|---|
| `ownable` | `ownerId` (TEXT, rel User) | — | `list<E>ForOwner` | `<E>OwnerOnly` (ENTITY) | 2 | V1 |
| `soft-deletable` | `deletedAt` (DATETIME?) | — | `restore<E>` | `<E>NotDeleted` | 3 | V1 |
| `publishable` | `status` (TEXT), `publishedAt` (DATETIME?) | — | `publish<E>`, `unpublish<E>`, `archive<E>` | `<E>PublishedOnly` | 3 | V1 |
| `taggable` | `tags` (TEXT[]) | — | — | — | 2 | V1 |
| `searchable` | — | — | `search<E>` (q: string) | — | 2 | V1 |
| `shareable` | — | `<E>` → `<E>ShareLink` (ONE_TO_MANY) | `createShareLinkFor<E>` | — | 1 | V1 |
| `auditable` | — | — | `list<E>AuditLog` | — | 2 | V1 (write hook V2) |
| `versioned` | `version` (NUMBER, default 1) | — | — | — | 2 | V1 |
| `commentable` | — | `<E>` → `Comment` (ONE_TO_MANY) | `addCommentTo<E>`, `list<E>Comments` | — | 2 | V1 |
| `attachable` | — | `<E>` → `Asset` (ONE_TO_MANY) | `attachFileTo<E>`, `list<E>Attachments` | — | 2 | V1 |
| `localizable` | `<field>Key` par champ traduisible | — | — | — | 1 par champ | V1 |

`<E>` = nom de l'entity (ex. `Ticket`). Les noms de champs sont configurables via `config`.

---

## Configs par Behavior

| Behavior | Champs config | Défauts |
|---|---|---|
| `ownable` | `ownerField` | `"ownerId"` |
| `soft-deletable` | `field` | `"deletedAt"` |
| `publishable` | `statusField`, `publishedAtField` | `"status"`, `"publishedAt"` |
| `taggable` | `field` | `"tags"` |
| `searchable` | `fields` (requis), `mode` | — / `"ilike"` |
| `shareable` | `linkEntityName`, `tokenField` | `"<E>ShareLink"`, `"token"` |
| `auditable` | `trackFields` | tous les champs |
| `versioned` | `versionField` | `"version"` |
| `commentable` | `commentEntityName`, `bodyField` | `"Comment"`, `"body"` |
| `attachable` | `assetEntityName` | `"Asset"` |
| `localizable` | `fields` (requis) | — |

---

## Expansion → DeltaSpec : exemple `Ticket` + `ownable`

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
        "rule": {
          "all": [
            { "exists": { "ref": "$.auth.userId" } },
            { "eq": [{ "ref": "$.auth.userId" }, { "ref": "$.record.ownerId" }] }
          ]
        }
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
          {
            "kind": "read",
            "entity": "Ticket",
            "many": true,
            "as": "items",
            "where": { "eq": [{ "ref": "$.record.ownerId" }, { "ref": "$.auth.userId" }] }
          },
          { "kind": "return", "value": { "ref": "$.items" } }
        ]
      }
    ]
  },
  "testScenarios": {
    "create": [
      {
        "name": "Ticket owner can read their own records",
        "operationName": "listTicketForOwner",
        "expected": { "statusCode": 200 }
      },
      {
        "name": "Ticket non-owner is denied",
        "expected": { "statusCode": 403 }
      }
    ]
  }
}
```

---

## Expansion → DeltaSpec : exemple `Post` + `soft-deletable`

```json
{
  "attributes": {
    "create": [
      {
        "entityName": "Post",
        "name": "deletedAt",
        "type": "DATETIME",
        "required": false
      }
    ]
  },
  "policies": {
    "create": [
      {
        "name": "PostNotDeleted",
        "scope": "ENTITY",
        "entityName": "Post",
        "effect": "ALLOW",
        "rule": { "not": { "exists": { "ref": "$.record.deletedAt" } } }
      }
    ]
  },
  "operations": {
    "create": [
      {
        "name": "restorePost",
        "kind": "COMMAND",
        "inputSchema": { "type": "object", "required": ["id"], "properties": { "id": { "type": "string" } } },
        "reads": ["Post"],
        "writes": ["Post"],
        "steps": [
          { "kind": "authorize", "policy": "authenticated-only" },
          {
            "kind": "mutate",
            "op": "update",
            "entity": "Post",
            "where": { "obj": { "id": { "ref": "$.input.id" } } },
            "data": { "obj": { "deletedAt": { "lit": null } } },
            "as": "post"
          },
          { "kind": "return", "value": { "ref": "$.post" } }
        ]
      }
    ]
  }
}
```

---

## API HTTP

### Dry-run preview (format texte V1)

```
POST /api/projects/:id/spec/expand-behaviors
```

Retourne `{ expansion: [{ entity, behavior, config, adds }] }`.

### Dry-run DeltaSpec (Phase 7, **canonique**)

```
POST /api/projects/:id/spec/expand-behaviors/delta
Content-Type: application/json

{
  "entities": [
    { "name": "Contact", "behaviors": ["ownable", "soft-deletable"] }
  ]
}
```

Retourne `{ deltaSpec, perBehavior }`.

Omettre `entities` pour utiliser les Behaviors déjà stockés pour le projet.

---

## MCP Tools

| Tool | Description |
|---|---|
| `dtfs__list_behaviors` | Retourne le catalogue des 11 behaviors |
| `dtfs__expand_behaviors` | Preview V1 OU DeltaSpec (passer `asDelta:true` ou `entities`) |
| `dtfs__expand_behaviors_to_delta` | Retourne toujours un DeltaSpec — explicite, recommandé |

### Exemple `dtfs__expand_behaviors_to_delta`

```json
{
  "projectId": "...",
  "entities": [
    { "name": "Ticket", "behaviors": ["ownable", "commentable"] }
  ]
}
```

---

## Comportement dry-run

L'expansion est **toujours un dry-run** — elle retourne un DeltaSpec sans l'appliquer. Pour matérialiser :

```
1. dtfs__expand_behaviors_to_delta(projectId, entities)  → { deltaSpec }
2. dtfs__validate_delta_spec(projectId, deltaSpec)       → { ok, errors }
3. dtfs__apply_delta_spec(projectId, deltaSpec, message) → { changeSetId }
```

---

## Statut V1 / V2

| Feature | V1 | V2 |
|---|---|---|
| DeltaSpec output (attributes, policies, operations) | 11 behaviors | — |
| Hook `auditable` : écriture auto AuditLog sur update | Description seulement | Hook codegen |
| `searchable` fulltext / external | ilike uniquement | fulltext / Meilisearch |
| `localizable` operation set-translation | — | `set<E>Translation` (COMMAND) |
| `shareable` gating de route publique | Operation seulement | Middleware codegen |

Note : AuditLog, Asset, Comment sont des modèles Phase 10 — référencés par nom dans le DeltaSpec, pas créés inline par l'expansion.
