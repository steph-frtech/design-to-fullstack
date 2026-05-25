# DeltaSpec

Un `DeltaSpec` est le **seul format autorisé** pour modifier le Control Plane. Tout agent doit produire un DeltaSpec, le faire passer par `validate_spec`, puis appeler `apply_spec` qui le matérialise en un `ChangeSet`. Il n'existe pas d'autre chemin d'écriture vers le Control Plane.

**Liens** : [[CONTROL_PLANE_MODEL]] · [[CHANGESET_REVISION]] · [[BEHAVIOR_EXPANSION]]

## Source of truth

`backend/src/lib/dsl/delta-spec.ts` (type complet + schéma Zod) · `docs/DELTA_SPEC.md` · `docs/CHANGESET_FLOW.md`

## AI usage

Ne jamais écrire directement en base hors d'un DeltaSpec. Ne jamais appliquer sans valider d'abord. Ne jamais appliquer hors d'un ChangeSet. Ne jamais produire de suppression destructive sans une Revision existante. Tout DeltaSpec doit être explicable en langage naturel via `dtfs__explain_delta_spec`.

## Status

V1 — 21 buckets déclarés. 9 buckets `not_implemented_yet` à l'apply (workflows, authMethods, assets, components, forms, fields, actions, dataBindings, testScenarios). Apply non transactionnel en V1 (cf. AUDIT_REPORT P0/P1).

---

## Règles impératives

1. **Aucune écriture hors DeltaSpec** — le middleware ChangeSet bloque tout write direct sans contexte ChangeSet.
2. **Aucun apply sans validate** — appeler `dtfs__validate_delta_spec` ou `POST /delta-spec/validate` avant `apply_spec`. (Garde-fou présent mais non enforced automatiquement en V1 — l'agent DOIT le respecter explicitement.)
3. **Aucun apply hors ChangeSet** — `applyDeltaSpec` appelle `runInChangeSet` en interne ; utiliser le shortcut one-shot ou ouvrir un ChangeSet explicitement.
4. **Aucune suppression destructive sans Revision** — le système revert via les Revisions ; supprimer sans version existante rend le revert impossible.
5. **Tout DeltaSpec explicable** — produire un DeltaSpec sans pouvoir l'expliquer en NL est un signal d'alerte.

---

## Format canonique — type complet

```typescript
type DeltaBlock<Create, Update, Ref> = {
  create?: Create[]
  update?: Update[]
  delete?: Ref[]   // Ref = { id: string }
}

type DeltaSpec = {
  // Layer 1-2 — Compréhension produit
  productSpecs?:  DeltaBlock<ProductSpecInput,  ProductSpecPatch,  { id: string }>
  screenSpecs?:   DeltaBlock<ScreenSpecInput,   ScreenSpecPatch,   { id: string }>
  requirements?:  DeltaBlock<RequirementInput,  RequirementPatch,  { id: string }>

  // Layer 6 — Modèle de données
  entities?:      DeltaBlock<EntityInput,       EntityPatch,       { id: string }>
  attributes?:    DeltaBlock<AttributeInput,    AttributePatch,    { id: string }>
  relations?:     DeltaBlock<RelationInput,     RelationPatch,     { id: string }>
  resources?:     DeltaBlock<ResourceInput,     ResourcePatch,     { id: string }>
  operations?:    DeltaBlock<OperationInput,    OperationPatch,    { id: string }>
  policies?:      DeltaBlock<PolicyInput,       PolicyPatch,       { id: string }>
  workflows?:     DeltaBlock<WorkflowInput,     WorkflowPatch,     { id: string }>  // V2
  triggers?:      DeltaBlock<TriggerInput,      TriggerPatch,      { id: string }>
  integrations?:  DeltaBlock<IntegrationInput,  IntegrationPatch,  { id: string }>
  assets?:        DeltaBlock<AssetInput,        AssetPatch,        { id: string }>  // V2
  authMethods?:   DeltaBlock<AuthMethodInput,   AuthMethodPatch,   { id: string }>  // V2

  // Layer 5 — UI
  screens?:       DeltaBlock<ScreenInput,       ScreenPatch,       { id: string }>
  components?:    DeltaBlock<ComponentInput,    ComponentPatch,    { id: string }>  // V2
  forms?:         DeltaBlock<FormInput,         FormPatch,         { id: string }>  // V2
  fields?:        DeltaBlock<FieldInput,        FieldPatch,        { id: string }>  // V2
  actions?:       DeltaBlock<ActionInput,       ActionPatch,       { id: string }>  // V2
  dataBindings?:  DeltaBlock<DataBindingInput,  DataBindingPatch,  { id: string }>  // V2

  // Layer 10 — Test
  testScenarios?: DeltaBlock<TestScenarioInput, TestScenarioPatch, { id: string }>  // V2
  
  // Note: runtimeTargets non exposés dans DeltaSpec — gérés via endpoint dédié
}
```

Le schéma Zod canonique est exporté depuis `backend/src/lib/dsl/delta-spec.ts` comme `deltaSpecSchema`.

---

## État d'implémentation des buckets (V1)

| Bucket | Apply V1 | Notes |
|---|---|---|
| productSpecs | ✅ | |
| screenSpecs | ✅ | |
| requirements | ✅ | |
| entities | ✅ | |
| attributes | ✅ | name-ref `entityName` résolu |
| relations | ✅ | name-refs `fromEntityName`/`toEntityName` résolus |
| policies | ✅ | name-ref `entityName` optionnel |
| integrations | ✅ | |
| operations | ✅ | |
| resources | ✅ | name-ref `entityName` résolu |
| triggers | ✅ | name-ref `operationName` résolu |
| screens | ✅ | |
| workflows | `not_implemented_yet` | logué dans `result.skipped` |
| authMethods | `not_implemented_yet` | logué dans `result.skipped` |
| assets | `not_implemented_yet` | logué dans `result.skipped` |
| components | `not_implemented_yet` | logué dans `result.skipped` |
| forms | `not_implemented_yet` | logué dans `result.skipped` |
| fields | `not_implemented_yet` | logué dans `result.skipped` |
| actions | `not_implemented_yet` | logué dans `result.skipped` |
| dataBindings | `not_implemented_yet` | logué dans `result.skipped` |
| testScenarios | `not_implemented_yet` | logué dans `result.skipped` |

---

## Cross-références par nom

Dans un DeltaSpec, les entités et opérations peuvent être référencées par nom plutôt que par id de base :

- `attributes.create[].entityName: "Contact"` — résolu au moment de l'apply
- `relations.create[].fromEntityName: "Order"`, `.toEntityName: "User"`
- `resources.create[].entityName: "Contact"`
- `policies.create[].entityName: "Contact"`
- `triggers.create[].operationName: "createOrder"`

L'étape d'apply résout ces noms en cherchant d'abord dans les `create` du même DeltaSpec, puis en base de données.

---

## Ordre d'apply (dépendances)

Les mutations s'appliquent dans cet ordre pour que les FK soient toujours résolues :

1. ProductSpecs, ScreenSpecs, Requirements (pas de dépendances)
2. Entities
3. Attributes (nécessitent Entity)
4. Relations (nécessitent 2 × Entity)
5. Policies (peuvent référencer Entity)
6. Integrations
7. Operations (nécessitent Policy + Integration)
8. Resources (nécessitent Entity + Policy)
9. Triggers (nécessitent Operation)
10. Workflows, AuthMethods, Assets (V2 — skipped)
11. Screens
12. Components, Forms, Fields, Actions, DataBindings, TestScenarios (V2 — skipped)
13. Deletes (ordre inverse des creates — cascade)

Les updates s'appliquent après les creates. Les deletes en dernier.

---

## Validation rules

`validateDeltaSpec(deltaSpec, ctx)` effectue des vérifications statiques (aucune écriture DB) :

1. Parse Zod contre `deltaSpecSchema`.
2. `attributes.create[].entityName` doit résoudre vers une entity existante ou créée dans ce spec.
3. `relations.create[]` `fromEntityName`/`toEntityName` — même règle.
4. `resources.create[].entityName` — même règle.
5. `policies.create[].entityName` — même règle.
6. `operations.create[].reads[]` et `.writes[]` — les entity names doivent résoudre.
7. `triggers.create[].operationName` — doit résoudre vers une operation existante ou créée dans ce spec.

`ctx` porte `existingEntityNames: Set<string>` et `existingOperationNames: Set<string>` (chargés depuis la DB par l'appelant).

---

## API

### HTTP

```
POST /api/projects/:id/delta-spec/from-proposal  { proposalId }      → { deltaSpec }
POST /api/projects/:id/delta-spec/validate       { deltaSpec }       → { ok, errors[] }
POST /api/projects/:id/delta-spec/explain        { deltaSpec }       → { markdown }
POST /api/projects/:id/delta-spec/apply          { deltaSpec, message } → { changeSetId, result }
```

### MCP

| Tool | Description |
|---|---|
| `dtfs__create_delta_from_platform_proposal` | Compile une PlatformSpecProposal acceptée en DeltaSpec |
| `dtfs__validate_delta_spec` | Lint statique sans écriture DB |
| `dtfs__explain_delta_spec` | Résumé NL du DeltaSpec |
| `dtfs__apply_delta_spec` | One-shot : open+apply+commit |

---

## Relation à PlatformSpecProposal

Une `PlatformSpecProposal` (Phase 6) est la synthèse **revue par un humain** de ce que le Control Plane devrait contenir pour une feature. Une fois ACCEPTED, elle se compile en DeltaSpec :

```
ProposalContents (DRAFT → ACCEPTED)
  → compileProposalToDelta()      # backend/src/lib/delta-spec-compile.ts
  → DeltaSpec
  → validateDeltaSpec()           # lint statique
  → applyDeltaSpec()              # écritures DB, émet ChangeSet
  → ChangeSet (APPLIED)
```

La compilation utilise des cross-refs par nom (ex. `entityName: "Contact"`) — la résolution des ids se fait à l'apply.

---

## Exemple — feature Todo-list

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
      { "entityName": "TodoList", "name": "title",   "type": "TEXT",     "required": true },
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
        "required": true,
        "cascade": { "onDelete": "CASCADE" }
      }
    ]
  },
  "policies": {
    "create": [
      {
        "name": "authenticated-only",
        "scope": "OPERATION",
        "effect": "ALLOW",
        "rule": { "exists": { "ref": "$.auth.userId" } }
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
          { "kind": "mutate", "op": "create", "entity": "TodoList",
            "data": { "obj": { "title": { "ref": "$.input.title" }, "ownerId": { "ref": "$.auth.userId" } } },
            "as": "list" },
          { "kind": "return", "value": { "ref": "$.list" } }
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

## Ce que DeltaSpec ne contient PAS

- **Pas de code** — le Step DSL décrit l'intent, pas le code source.
- **Pas de DDL** — le codegen (Phase 9) produit le DDL réel.
- **Pas de secrets** — `secretRefs` pointe uniquement vers des env vars / vault paths.
- **Pas de contenu de fichiers** — les uploads Asset passent par des endpoints dédiés.
- **Pas de runtimeTargets** — gérés via leur propre endpoint.
