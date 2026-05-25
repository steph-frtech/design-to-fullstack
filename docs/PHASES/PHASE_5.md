# Phase 5 — Requirements + Platform Mapping

Phase 5 transforme les artefacts SDD (Phase 4) en **exigences traçables**
puis les mappe sur les concepts du Control Plane (Entity, Operation,
Policy, Screen, Field, TestScenario…). C'est la dernière étape avant
le DeltaSpec (Phase 6) — la traçabilité est garantie : aucune
fonctionnalité ne disparaît pendant la codegen.

## Modèles

```prisma
model Requirement {
  id, projectId, productSpecId String?,
  key String,              // REQ-001, REQ-042, …
  title String,
  description String,
  priority String?,        // MUST | SHOULD | NICE | HIGH | CRITICAL | …
  status String @default("DRAFT"),  // DRAFT | ACCEPTED | MAPPED | REJECTED
  acceptanceCriteria Json?,  // [{ given, when, then }]
  source String?,          // natural | speckit | imported | manual
  currentVersion Int,
  createdAt, updatedAt
  @@unique([projectId, key])
}

model RequirementMapping {
  id, projectId, requirementId,
  targetType String,       // Entity | Operation | Policy | Screen | Field | TestScenario | …
  targetId String,         // Control Plane row id
  confidence Float?,        // 0.0–1.0
  rationale String?,
  createdAt
}
```

## Statuts Requirement

| Status      | Bloque le coverage gate ?                  | Sémantique                           |
|-------------|--------------------------------------------|--------------------------------------|
| `DRAFT`     | non (sauf priority MUST/HIGH/CRITICAL)      | Juste extrait, pas encore validé     |
| `ACCEPTED`  | OUI si pas de mapping                       | Validé "in scope" par l'utilisateur  |
| `MAPPED`    | non (toujours OK)                           | Au moins 1 RequirementMapping        |
| `REJECTED`  | non                                          | Out of scope, ignoré par codegen     |

**Auto-transition** : créer un premier RequirementMapping fait passer
le Requirement de DRAFT/ACCEPTED → MAPPED automatiquement.

## Coverage gate

`GET /api/projects/:id/coverage-gate` renvoie :

```jsonc
{
  "blocked": true,
  "entries": [
    {
      "requirementId": "...",
      "key": "REQ-001",
      "title": "Créer une demande SAV",
      "priority": "MUST",
      "status": "ACCEPTED",
      "mappingsCount": 0,
      "blocked": true
    },
    { "key": "REQ-002", "blocked": false, ... }
  ]
}
```

Règle V1 : `blocked = true` si **(priority ∈ {MUST, HIGH, CRITICAL} OU
status === "ACCEPTED" OU status === "MAPPED")** ET `mappingsCount === 0`.

Comme pour Phase 3, **V1 n'enforce pas** le gate dans `apply_spec` —
l'agent / UI le consulte. Phase 6 ajoutera l'enforcement.

## API surface

### HTTP — Requirement
```
GET    /api/projects/:id/requirements?status=&priority=&productSpecId=
GET    /api/projects/:id/requirements/:rid
POST   /api/projects/:id/requirements                  { key, title, description, ... }
PUT    /api/projects/:id/requirements/:rid             (patch)
DELETE /api/projects/:id/requirements/:rid
POST   /api/projects/:id/requirements/:rid/accept                   → ACCEPTED
POST   /api/projects/:id/requirements/:rid/reject                   → REJECTED
POST   /api/projects/:id/requirements/extract          { featureKey, requirements: [...], source } → bulk
```

### HTTP — RequirementMapping
```
GET    /api/projects/:id/requirement-mappings?requirementId=&targetType=
GET    /api/projects/:id/requirement-mappings/:mid
POST   /api/projects/:id/requirement-mappings          { requirementId, targetType, targetId, ... }
PUT    /api/projects/:id/requirement-mappings/:mid     (patch)
DELETE /api/projects/:id/requirement-mappings/:mid
POST   /api/projects/:id/requirement-mappings/bulk     { mappings: [...] }
```

### HTTP — Gate
```
GET    /api/projects/:id/coverage-gate
```

### MCP (8 tools)
```
dtfs__list_requirements(projectId, status?, priority?, productSpecId?)
dtfs__get_requirement(requirementId)
dtfs__extract_requirements(projectId, featureKey, source, requirements)
dtfs__accept_requirement(requirementId)
dtfs__reject_requirement(requirementId)
dtfs__map_requirements_to_platform(projectId, mappings)
dtfs__list_requirement_mappings(projectId, requirementId?, targetType?)
dtfs__validate_requirement_coverage(projectId)
```

## Versioning

- `Requirement` est dans `VERSIONED_MODELS` ET `MODELS_WITH_CURRENT_VERSION`
  (colonne `currentVersion` bumped par l'extension).
- `RequirementMapping` est dans `VERSIONED_MODELS` mais PAS dans
  `MODELS_WITH_CURRENT_VERSION` — version dérivée via
  `nextRevisionVersion` (même mécanisme que OpenQuestion / Assumption).

## Agents

### `dtfs-requirement-extractor`
- Refuse si SDD pas `complete`.
- Lit constitution + spec + tasks.
- Extrait REQ-NNN avec acceptanceCriteria (Given/When/Then).
- Bulk upsert via `extract_requirements`.
- Crée des OpenQuestion pour les ambigüités.

### `dtfs-platform-mapper`
- Lit le snapshot Control Plane complet.
- Pour chaque Requirement non mappé, propose des mappings (Entity,
  Operation, Policy, Screen, Field, TestScenario).
- Si la cible n'existe pas encore → OpenQuestion (n'invente pas).
- `confidence` honnête : <0.4 → ne map pas, crée une question.

## Slash commands

- `/dtfs:extract-requirements <featureKey>` — lance l'extractor
- `/dtfs:map-platform [featureKey]` — lance le mapper

## Exemple bout-en-bout — SAV

Après les Phases 1-4 :

```
ProductSpec    : "SAV multi-rôle"
ScreenSpec     : "Dashboard manager", "Create support ticket"
SpecArtifact   : constitution.md + specs/001-support/{spec,plan,tasks}.md
```

`/dtfs:extract-requirements 001-support` produit :

```
REQ-001  priority: MUST   title: Créer une demande SAV
REQ-002  priority: MUST   title: Traiter une demande (agent)
REQ-003  priority: SHOULD title: Rembourser via Stripe
REQ-004  priority: SHOULD title: Dashboard manager avec KPIs
REQ-005  priority: NICE   title: Notifications push
```

`/dtfs:map-platform 001-support` produit (pour REQ-001) :

```
REQ-001 → Entity        SupportTicket          (confidence 0.95)
REQ-001 → Operation     createSupportTicket    (confidence 0.95)
REQ-001 → Screen        create-support-ticket  (confidence 0.90)
REQ-001 → Policy        customerCanCreateOwnTicket (confidence 0.85)
REQ-001 → TestScenario  customer_create_ticket_success (confidence 0.80)
```

REQ-005 (notifications push) → cible `Operation sendPushNotification`
inexistante → OpenQuestion créée : "REQ-005 needs Operation
`sendPushNotification` but none exists. Should we create it ?"

Coverage gate après : `blocked: false` car REQ-005 a priority `NICE`
(non bloquant) et tous les MUST/SHOULD sont mappés.

## Hors scope Phase 5

- **Enforcement du gate dans apply_spec** — V1 expose seulement.
  Phase 6 enforce.
- **Auto-création des cibles manquantes** — V1 reste honnête (OpenQuestion).
  Phase 6 pourra émettre un DeltaSpec à partir des OpenQuestion répondues.
- **Score ML pour confidence** — V1 utilise des heuristiques agent.
- **Reverse lookup target → Requirements** — queryable manuellement.
- **UI éditeur** — pas en V1.

## Phase 5 → Phase 6

Une fois `coverage-gate.blocked === false`, le projet a une cartographie
complète : chaque requirement in-scope a au moins une cible identifiée.
**Phase 6** (déjà en V1 via `apply_spec`) prend ces mappings + le delta
implicite (cibles à créer si certains ont été acceptés "to-create") et
produit le DeltaSpec final qui matérialise tout côté Control Plane.
