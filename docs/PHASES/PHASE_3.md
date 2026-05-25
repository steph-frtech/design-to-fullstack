# Phase 3 — Clarification, hypothèses et questions ouvertes

Phase 3 promeut chaque incertitude au rang de **première classe** :
- Une `OpenQuestion` est un point à vérifier auprès de l'utilisateur.
- Une `Assumption` est une décision que le système a prise par défaut et
  qui doit être validée ou rejetée.

Tant qu'au moins une OpenQuestion ou Assumption est en status `OPEN`,
le **clarification gate** est bloqué : aucun DeltaSpec ne devrait être
généré tant qu'on n'a pas résolu ces items.

## Modèles

```prisma
model OpenQuestion {
  id        String   @id @default(cuid())
  projectId String
  scope     String   // ex. "screen:Dashboard", "feature:billing", "global"
  targetId  String?  // id d'un ScreenSpec, ProductSpec, etc.
  question  String
  answer    String?
  status    String   @default("OPEN")  // OPEN | ANSWERED | DEFERRED
  createdAt DateTime
  updatedAt DateTime
}

model Assumption {
  id        String   @id @default(cuid())
  projectId String
  scope     String
  targetId  String?
  text      String
  status    String   @default("OPEN")  // OPEN | ACCEPTED | REJECTED
  createdAt DateTime
  updatedAt DateTime
}
```

`scope` est libre — convention recommandée :
- `"global"` — concerne le projet entier
- `"screen:<name>"` — concerne un écran spécifique
- `"feature:<name>"` — concerne une feature transverse
- `"entity:<name>"` — concerne un objet métier

`targetId`, optionnel, pointe vers le row concret (par exemple l'id d'un
`ScreenSpec`). Combinaison `scope`/`targetId` = traçabilité fine.

## Statuts

### OpenQuestion

| Status     | Bloque le gate ? | Sémantique                                              |
|------------|------------------|---------------------------------------------------------|
| `OPEN`     | oui              | À poser à l'utilisateur                                 |
| `ANSWERED` | non              | Réponse capturée dans `answer`                          |
| `DEFERRED` | non              | "On verra plus tard" — n'empêche pas de continuer       |

### Assumption

| Status     | Bloque le gate ? | Sémantique                                              |
|------------|------------------|---------------------------------------------------------|
| `OPEN`     | oui              | Pas encore validée par l'utilisateur                    |
| `ACCEPTED` | non              | L'utilisateur a confirmé                                |
| `REJECTED` | non              | L'utilisateur a infirmé — le projet doit en tenir compte|

## Le clarification gate

`GET /api/projects/:id/clarification-gate` retourne :

```jsonc
{
  "blocked": true,
  "openQuestions": [
    { "id": "...", "scope": "feature:billing",
      "question": "Le remboursement est-il connecté à Stripe ou traité manuellement ?",
      "targetId": null }
  ],
  "openAssumptions": [
    { "id": "...", "scope": "feature:auth",
      "text": "Un client doit être authentifié pour créer une demande SAV.",
      "targetId": null }
  ]
}
```

V1 ne **force** pas le gate dans `apply_spec` — c'est l'agent / UI qui
vérifie. L'enforcement automatique vient en Phase 6.

## Process LLM (agent `dtfs-question-manager`)

1. `check_clarification_gate(projectId)` — état initial
2. Lister + présenter les items ouverts (`list_open_questions`,
   `list_assumptions`)
3. Pour chaque OpenQuestion : demander à l'utilisateur (`AskUserQuestion`
   ou prose), puis `answer_open_question` ou `defer_open_question`
4. Pour chaque Assumption : demander Accepter/Rejeter/Différer
5. Re-vérifier le gate
6. Reporter

**Règle d'or** : l'agent ne répond JAMAIS lui-même. Il drive le dialogue
mais l'utilisateur tranche.

## API surface

### HTTP — OpenQuestion
```
GET    /api/projects/:id/open-questions?status=
GET    /api/projects/:id/open-questions/:oqid
POST   /api/projects/:id/open-questions               { scope, question, targetId? }
PUT    /api/projects/:id/open-questions/:oqid         (patch)
DELETE /api/projects/:id/open-questions/:oqid
POST   /api/projects/:id/open-questions/:oqid/answer  { answer }   → ANSWERED
POST   /api/projects/:id/open-questions/:oqid/defer                → DEFERRED
```

### HTTP — Assumption
```
GET    /api/projects/:id/assumptions?status=
GET    /api/projects/:id/assumptions/:aid
POST   /api/projects/:id/assumptions                  { scope, text, targetId? }
PUT    /api/projects/:id/assumptions/:aid             (patch)
DELETE /api/projects/:id/assumptions/:aid
POST   /api/projects/:id/assumptions/:aid/accept                   → ACCEPTED
POST   /api/projects/:id/assumptions/:aid/reject      { reason? }  → REJECTED
```

### HTTP — Gate
```
GET    /api/projects/:id/clarification-gate          → GateResult
```

### MCP (9 tools)
```
dtfs__list_open_questions(projectId, status?)
dtfs__create_open_question(projectId, scope, question, targetId?)
dtfs__answer_open_question(openQuestionId, answer)
dtfs__defer_open_question(openQuestionId)

dtfs__list_assumptions(projectId, status?)
dtfs__create_assumption(projectId, scope, text, targetId?)
dtfs__accept_assumption(assumptionId)
dtfs__reject_assumption(assumptionId, reason?)

dtfs__check_clarification_gate(projectId)
```

### Versioning

Les deux modèles sont dans `VERSIONED_MODELS`. Chaque
create/answer/accept/reject émet une Revision liée à un ChangeSet —
l'historique est queryable et revertable.

## Exemple

Après Phase 1 (ProductSpec SAV), l'agent produit notamment :

```json
{
  "openQuestions": [
    { "question": "Le remboursement est-il connecté à Stripe ou traité manuellement ?" }
  ],
  "assumptions": [
    { "statement": "Un client doit être authentifié pour créer une demande SAV", "confidence": "MEDIUM" }
  ]
}
```

L'agent `dtfs-product-analyst` peut ensuite **promouvoir** ces items dans
les tables Phase 3 (via `dtfs__create_open_question` /
`dtfs__create_assumption`). Le scope `"feature:billing"` /
`"feature:auth"` permet la traçabilité.

Plus tard, `/dtfs:clarify` lance le dialogue :

```
Question : Le remboursement est-il connecté à Stripe ou traité manuellement ?
  → Stripe (recommended)
  → Manuel
  → Hybride

User clicks "Stripe" → answer_open_question(id, "Stripe")
                                  ↓
Hypothèse : Un client doit être authentifié pour créer une demande SAV.
  → Accepter (recommended)
  → Rejeter
  → Différer

User clicks "Accepter" → accept_assumption(id)
                                  ↓
check_clarification_gate → blocked: false
```

## Hors scope Phase 3

- **Priorité explicite** sur Assumption (`critical: boolean`) — V1 traite
  toute Assumption `OPEN` comme bloquante.
- **Migration automatique** des `openQuestions`/`assumptions` JSON
  arrays existant dans ProductSpec/ScreenSpec vers les nouvelles tables
  — l'agent le fait à la demande, pas de hook auto.
- **Enforcement** du gate dans `apply_spec` — Phase 6.
- **UI éditeur** dédié.

## Phase 3 → Phase 4

Une fois `clarification-gate.blocked === false`, le projet peut passer à
**Phase 4 — Spec Kit** : production des artefacts Markdown
(`constitution.md`, `spec.md`, `plan.md`, `tasks.md`) qui formaliseront
la spec fonctionnelle avant le mapping plateforme (Phase 5).
