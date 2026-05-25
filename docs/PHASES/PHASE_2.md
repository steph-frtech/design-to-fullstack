# Phase 2 — Screen Understanding

Phase 2 captures the **functional intent** of each screen the user wants
in the app — *before* any HTML, code, or component tree exists.

## Inputs (from layer 0 + layer 1)

- The project's `ProductSpec` (provides business objects, personas,
  business rules — used as the type-checking dictionary)
- A natural-language description of the screen, e.g.
  > "Écran dashboard manager : je veux voir les tickets ouverts, les
  > tickets en retard, les remboursements à valider et une liste
  > filtrable des dernières demandes."
- *Optionally* : an HTML mockup or sketch reference (the agent reads it
  with the `Read` tool, but parsing is not mandatory)

## Outputs

One `ScreenSpec` row per screen. Schema :

```prisma
model ScreenSpec {
  id              String   @id
  projectId       String
  productSpecId   String?
  name            String
  description     String
  actor           String?
  purpose         String?
  userIntent      String?
  layoutHint      String?
  components      Json?
  fields          Json?
  actions         Json?
  dataNeeds       Json?
  businessRules   Json?
  emptyStates     Json?
  errorStates     Json?
  assumptions     Json?
  openQuestions   Json?
  currentVersion  Int
  createdAt       DateTime
  updatedAt       DateTime
}
```

JSON shapes (per row inside the array columns) :

```ts
type ScreenComponent = {
  kind: "header" | "list" | "table" | "form" | "card" | "chart" | "summary" | string;
  label?: string;
  description?: string;
};

type ScreenField = {
  name: string;
  type: "TEXT" | "EMAIL" | "NUMBER" | "DATE" | "SELECT" | "CHECKBOX" | "FILE" | string;
  required?: boolean;
  helpText?: string;
};

type ScreenAction = {
  label: string;
  kind: "submit" | "navigate" | "open-modal" | "call-operation" | string;
  target?: string;
  requiresAuth?: boolean;
};

type ScreenDataNeed = {
  entity: string;                       // hypothetical or known
  shape: "single" | "list" | "summary";
  filterBy?: string[];
  realtime?: boolean;
};

type ScreenState = {
  trigger: string;
  message: string;
  cta?: string;
};

type Assumption = { statement: string; confidence: "LOW"|"MEDIUM"|"HIGH"; rationale?: string };
type OpenQuestion = { question: string; blockedBy?: string[] };
```

## Validation rules

`validateScreenSpec(spec)` checks **9 required fields** :

1. `name` — non-empty string
2. `description` — non-empty string
3. `actor` — non-empty string
4. `purpose` — non-empty string
5. `components` — non-empty array
6. `dataNeeds` — non-empty array
7. `actions` — non-empty array
8. `openQuestions` — non-empty array
9. `assumptions` — non-empty array

A screen with ANY required field `missing` or `empty` fails `isComplete()`.
Downstream phases (Phase 5 mapping → Screen / Operations / Forms) refuse
to consume incomplete ScreenSpecs.

## Why `fields` is optional

`fields` is for input forms only. Read-only screens (dashboards,
listings) don't have them. The agent leaves `fields` undefined for those.

## Why `businessRules` is optional at screen level

The `BusinessRule[]` in the `ProductSpec` is the master list. The screen
copies (or refines) only the rules **enforced on this specific screen**.
If a screen has no form / submission, this stays undefined.

## Process

The `dtfs-screen-spec-writer` agent drives the extraction :

1. Identifies the project.
2. Fetches the `ProductSpec` for type-checking entity names.
3. Reads the user's description (and any attached HTML/MD).
4. Asks at most 3 clarification questions on critical ambiguities.
5. Produces the JSON.
6. Calls `dtfs__create_screen_spec`.
7. Calls `dtfs__validate_screen_spec`, iterates if needed.
8. Reports the `screenSpecId` + 5-line summary.

## API surface

### HTTP
```
GET    /api/projects/:id/screen-specs              → list
GET    /api/projects/:id/screen-specs/:ssid        → one
POST   /api/projects/:id/screen-specs              → create
PUT    /api/projects/:id/screen-specs/:ssid        → update
DELETE /api/projects/:id/screen-specs/:ssid        → delete
POST   /api/projects/:id/screen-specs/:ssid/validate → returns checklist
```

### MCP (5 tools)
```
dtfs__list_screen_specs(projectId)
dtfs__get_screen_spec(screenSpecId)
dtfs__create_screen_spec(projectId, ...spec)
dtfs__update_screen_spec(screenSpecId, patch)
dtfs__validate_screen_spec(screenSpecId)
```

### Versioning

`ScreenSpec` is in `VERSIONED_MODELS` — every mutation emits a Revision
linked to the active ChangeSet. Reverts work atomically.

## Example — Dashboard manager du SAV

User input :
> "Écran dashboard manager : je veux voir les tickets ouverts, les
> tickets en retard, les remboursements à valider et une liste
> filtrable des dernières demandes."

Expected ScreenSpec (abridged) :

```json
{
  "name": "Dashboard manager",
  "description": "Vue de pilotage temps réel pour les managers SAV : KPIs principaux + liste filtrable des dernières demandes.",
  "actor": "Manager",
  "purpose": "Surveiller le pipeline SAV et identifier les goulots d'étranglement.",
  "userIntent": "Au matin / pendant la journée, en quelques regards.",
  "layoutHint": "dashboard grid 4-cards + table",

  "components": [
    { "kind": "header", "label": "Dashboard SAV", "description": "Titre + sélecteur période" },
    { "kind": "card", "label": "Tickets ouverts", "description": "Compteur + variation 24h" },
    { "kind": "card", "label": "Tickets en retard", "description": "Compteur + lien vers la file" },
    { "kind": "card", "label": "Remboursements à valider", "description": "Compteur + bouton de validation rapide" },
    { "kind": "card", "label": "Temps moyen de résolution", "description": "KPI principal" },
    { "kind": "table", "label": "Dernières demandes", "description": "Liste paginée avec filtres" }
  ],

  "dataNeeds": [
    { "entity": "Ticket", "shape": "summary", "filterBy": ["status:open"] },
    { "entity": "Ticket", "shape": "summary", "filterBy": ["status:in_progress", "overdue:true"] },
    { "entity": "Refund", "shape": "summary", "filterBy": ["status:pending"] },
    { "entity": "Ticket", "shape": "summary", "filterBy": ["range:7d", "status:closed"], "realtime": false },
    { "entity": "Ticket", "shape": "list", "filterBy": ["status", "agent", "dateRange"], "realtime": true }
  ],

  "actions": [
    { "label": "Voir la file en retard", "kind": "navigate", "target": "/tickets?status=overdue", "requiresAuth": true },
    { "label": "Valider un remboursement", "kind": "open-modal", "target": "ValidateRefundModal", "requiresAuth": true },
    { "label": "Filtrer la liste", "kind": "navigate", "target": "/tickets?filter=...", "requiresAuth": true }
  ],

  "emptyStates": [
    { "trigger": "no overdue tickets", "message": "Aucun ticket en retard. Bien joué.", "cta": "Voir tous les tickets" },
    { "trigger": "no pending refunds", "message": "Aucun remboursement en attente." }
  ],

  "errorStates": [
    { "trigger": "fetch failure", "message": "Impossible de charger les KPIs. Réessayer dans un instant.", "cta": "Réessayer" }
  ],

  "openQuestions": [
    { "question": "La période par défaut du dashboard est-elle 24h ou 7j ?" },
    { "question": "Les KPIs s'actualisent en temps réel ou à la demande ?" }
  ],

  "assumptions": [
    { "statement": "Le manager voit TOUS les tickets, pas seulement les siens", "confidence": "HIGH" },
    { "statement": "Le bouton 'Valider un remboursement' ouvre une modale, pas une nouvelle page", "confidence": "MEDIUM" },
    { "statement": "Mobile-first n'est pas requis sur le dashboard manager", "confidence": "MEDIUM" }
  ]
}
```

## Phase 2 → Phase 5 transition

ScreenSpecs are NOT yet mapped to actual `Screen` / `Component` /
`Form` / `Field` rows. That mapping happens at **Phase 5 — Platform
Mapping** : an agent reads the ScreenSpec + ProductSpec and emits
`Requirement` + `RequirementMapping` rows, plus the DeltaSpec to create
the actual Control Plane rows.

For now, ScreenSpec sits as pure functional intent — useful for human
review, LLM downstream context, and Spec Kit artifacts (Phase 4).
