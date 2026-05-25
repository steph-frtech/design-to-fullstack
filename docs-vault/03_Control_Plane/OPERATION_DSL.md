# Operation DSL — Step Language

Chaque `Operation.steps` est une liste de valeurs `OperationStep` typées évaluées en séquence. Le LLM écrit des steps déclaratifs — pas de code. Les expressions sont des noeuds `Expr` AST typés (voir [[EXPR_DSL]]) — pas des strings JSONata libres.

**Liens** : [[EXPR_DSL]] · [[POLICY_DSL]] · [[CONTROL_PLANE_MODEL]] · [[DELTA_SPEC]]

## Source of truth

`backend/src/lib/dsl/operation-dsl.ts` · `backend/src/lib/dsl/operation-validate.ts` · `backend/src/lib/dsl/operation-analyze.ts` · `docs/OPERATION_DSL.md`

## AI usage

Utiliser uniquement les 10 kinds de steps listés. Toutes les expressions utilisent l'AST Expr typé (pas de JSONata libre). Les refs `entity` et `policy` dans les steps doivent référencer des noms connus du projet. Le champ `as` doit matcher `/^[a-z][a-zA-Z0-9_]*$/`. Ne pas utiliser `kind=WORKFLOW` en V1.

## Status

V1 active — 10 steps implémentés. `OPERATION_STEP_KINDS` fermé. Validation statique disponible via `validateOperationBody`.

---

## Operation.kind

| Valeur | Sémantique |
|---|---|
| `QUERY` | Read-only — pas de mutations, pas d'émission d'événements |
| `COMMAND` | Side-effect — mutations, événements, intégrations |
| `WORKFLOW` | Réservé V3+ (Temporal). **Ne pas utiliser en V1.** |

---

## Les 10 kinds de OperationStep

`OPERATION_STEP_KINDS = ["validate","authorize","read","mutate","callIntegration","emitEvent","branch","assert","log","return"]`

### `validate`

```json
{ "kind": "validate", "schema": <JsonSchema> }
```

Valide l'input contre le JSON Schema fourni. Lève une erreur structurée en cas d'échec. Le schema est un objet JSON Schema — pas une Expr.

---

### `authorize`

```json
{ "kind": "authorize", "policy": "owner-only" }
```

Lookup la Policy nommée dans le projet, évalue son arbre `PolicyRule` contre le scope courant. Lève un 403 sur DENY. `policy` doit exister dans le projet (validé statiquement).

---

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

Récupère une ou plusieurs lignes de l'entity nommée. `where` et `many` sont optionnels. Résultat lié à `$.as` pour les steps suivants.

**`as` doit matcher `/^[a-z][a-zA-Z0-9_]*$/`** (commence par une lettre minuscule).

---

### `mutate`

```json
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
}
```

`op` ∈ `create | update | delete`. Exigences par op :

| op | `data` requis | `where` requis |
|---|---|---|
| `create` | oui | non |
| `update` | oui | oui |
| `delete` | non | oui |

`as` est optionnel mais doit matcher le regex identifiant quand présent.

---

### `callIntegration`

```json
{
  "kind": "callIntegration",
  "integration": "email",
  "capability": "send",
  "input": {
    "obj": {
      "to":      { "ref": "$.input.email" },
      "subject": { "lit": "Welcome" }
    }
  },
  "as": "emailResult"
}
```

Invoque une intégration externe. `integration` et `capability` sont validés contre les intégrations du projet. `as` optionnel.

---

### `emitEvent`

```json
{
  "kind": "emitEvent",
  "event": "list.created",
  "payload": { "obj": { "id": { "ref": "$.list.id" } } }
}
```

Publie un événement interne. Consommé par les `Trigger { kind: "EVENT" }`. Si `eventNames` sont connus à la validation, `event` est vérifié.

---

### `branch`

```json
{
  "kind": "branch",
  "if": { "ref": "$.input.isPublic" },
  "then": [{ "kind": "return", "value": { "lit": "public" } }],
  "else": [{ "kind": "return", "value": { "lit": "private" } }]
}
```

Exécution conditionnelle. `else` est optionnel. Les alias de steps définis dans `then`/`else` sont mergés et visibles pour les steps suivants. Si `expectedReturn` est true, BOTH `then` et `else` doivent contenir un return.

---

### `assert`

```json
{
  "kind": "assert",
  "condition": { "ref": "$.list.id" },
  "message": "list must exist"
}
```

Lève une erreur runtime si `condition` est falsy.

---

### `log`

```json
{
  "kind": "log",
  "level": "info",
  "message": { "call": "concat", "args": [{ "lit": "Created: " }, { "ref": "$.list.id" }] }
}
```

Émet une entrée de log structurée. `level` ∈ `info | warn | error`.

---

### `return`

```json
{ "kind": "return", "value": { "ref": "$.list" } }
```

Retourne la valeur depuis l'operation. Les steps après ce point sont inatteignables.

---

## Exemple complet : `createTodoList`

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

---

## Exemple avec branch : `transferMoney`

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

## Validation statique

### `validateOperationBody(steps, ctx)`

Source : `backend/src/lib/dsl/operation-validate.ts`

```typescript
type OperationValidateCtx = {
  entityNames:       string[];
  policyNames:       string[];
  integrationNames:  string[];
  eventNames?:       string[];   // si absent, emitEvent.event n'est pas vérifié
  expectedReturn?:   boolean;    // si true, au moins un return doit exister
}
```

Vérifications effectuées :
- Parse Zod de chaque step.
- `read.entity` et `mutate.entity` doivent être dans `entityNames`.
- `authorize.policy` doit être dans `policyNames`.
- `callIntegration.integration` doit être dans `integrationNames`.
- `emitEvent.event` doit être dans `eventNames` (si fourni).
- `mutate op:"create"` requiert `data`. `op:"update"` requiert `data` + `where`. `op:"delete"` requiert `where`.
- Tous les `as` identifiers doivent matcher `/^[a-z][a-zA-Z0-9_]*$/`.
- Tous les champs `Expr` validés avec `validateExpr`, en accumulant les aliases de steps.
- Si `expectedReturn=true` : au moins un `return` en top-level OU le dernier step est un `branch` avec `then` et `else` contenant chacun un `return`.

Retourne `{ ok: boolean; errors: { path, code, message }[] }`.

---

## Analyse statique

`backend/src/lib/dsl/operation-analyze.ts` :

| Fonction | Description |
|---|---|
| `collectOperationReads(body)` | Entity names des steps `read` (unique, trié) |
| `collectOperationWrites(body)` | Entity names des steps `mutate` (unique, trié) |
| `collectOperationEntities(body)` | Union reads + writes (unique, trié) |
| `collectOperationPolicies(body)` | Policy names des steps `authorize` |
| `collectOperationIntegrations(body)` | Integration keys des steps `callIntegration` |
| `collectOperationEvents(body)` | Event names des steps `emitEvent` |

Toutes les fonctions récursivement dans `branch.then` et `branch.else`.

---

## MCP Tools

| Tool | Description |
|---|---|
| `dtfs__validate_operation_body` | Valide `steps[]` contre le contexte projet depuis la DB |
| `dtfs__analyze_operation_body` | Extrait entities/policies/integrations/events |
| `dtfs__validate_policy_rule` | Valide un arbre PolicyRule |
| `dtfs__list_operation_step_kinds` | Liste les 10 kinds avec descriptions |
| `dtfs__list_policy_rule_ops` | Liste les 12 opérateurs PolicyRule |

## Endpoints HTTP

```
GET  /api/projects/:id/operation-dsl/step-kinds      → { kinds }
GET  /api/projects/:id/operation-dsl/policy-ops      → { ops }
POST /api/projects/:id/operation-dsl/validate-body   { steps, expectedReturn? } → { ok, errors }
POST /api/projects/:id/operation-dsl/analyze-body    { steps } → { reads, writes, integrations, events, policies }
POST /api/projects/:id/operation-dsl/validate-policy { rule }  → { ok, errors }
```
