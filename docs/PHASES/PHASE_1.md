# Phase 1 — Product Understanding

Phase 1 of the design-to-fullstack pipeline transforms a natural-language
description of an application into a structured `ProductSpec`.

## Inputs (from layer 0)

The user provides any of :

- A free-form prose description (`"Je veux une app SAV …"`)
- A list of bullet-point features
- A user persona profile
- References to similar apps

These are transient — never stored as-is.

## Outputs

One `ProductSpec` row per Project. Schema :

```prisma
model ProductSpec {
  id              String   @id
  projectId       String
  title           String
  description     String
  domain          String?
  targetUsers     Json     // Persona[]
  goals           Json     // Goal[]
  nonGoals        Json?    // string[]
  personas        Json?    // Persona[] (extended)
  userJourneys    Json?    // UserJourney[]
  businessObjects Json?    // BusinessObject[]
  businessRules   Json?    // BusinessRule[]
  glossary        Json?    // GlossaryTerm[]
  assumptions     Json?    // Assumption[]
  openQuestions   Json?    // OpenQuestion[]
  currentVersion  Int
  createdAt       DateTime
  updatedAt       DateTime
}
```

JSON shapes (informal, see also `BACKEND_MODEL.md`) :

```ts
type Persona = {
  kind: "primary" | "secondary" | "admin" | string;
  label: string;
  needs?: string[];
  frustrations?: string[];
};

type Goal = {
  kind: "USER" | "BUSINESS" | "TECHNICAL";
  title: string;
  metric?: string;
};

type UserJourney = {
  name: string;
  steps: string[];
  happyPath: string;
  edgeCases?: string[];
};

type BusinessObject = {
  name: string;
  attributes: { name: string; type: string; note?: string }[];
  relations?: { to: string; kind: string }[];
  lifecycle?: string[];
};

type BusinessRule = {
  id: string;          // local id like "R-01"
  statement: string;
  appliesTo: string[]; // BusinessObject names
  priority: "MUST" | "SHOULD" | "NICE";
};

type Assumption = {
  statement: string;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  rationale?: string;
};

type OpenQuestion = {
  question: string;
  blockedBy?: string[];
};
```

## Validation rules

`validateProductSpec(spec)` checks **9 required fields** :

1. `title` — non-empty string
2. `description` — non-empty string
3. `targetUsers` — non-empty array
4. `goals` — non-empty array
5. `businessObjects` — non-empty array
6. `businessRules` — non-empty array
7. `userJourneys` — non-empty array
8. `openQuestions` — non-empty array (empty array allowed only after the
   agent has actively resolved all questions and the user has confirmed)
9. `assumptions` — non-empty array (same rule — at least the assumption
   "no critical assumptions remain" must be present)

A ProductSpec with ANY required field `missing` or `empty` is rejected
by `isComplete()`. The platform still allows storage of incomplete specs
(via PUT) — but downstream phases (Phase 2+) refuse to consume them.

## Process

The `dtfs-product-analyst` agent drives the extraction :

1. Reads the user description (and optionally project context).
2. Asks at most 3 clarification questions if ambiguous.
3. Produces the ProductSpec JSON.
4. Calls `dtfs__create_product_spec`.
5. Calls `dtfs__validate_product_spec` and resolves any gaps.
6. Reports the `productSpecId` + a 5-line summary.

The backend is dumb storage — it neither calls Anthropic nor any other
LLM. The agent (running inside Claude Code) does the work.

## API surface

### HTTP
```
GET    /api/projects/:id/product-specs              → list
GET    /api/projects/:id/product-specs/:psid        → one
POST   /api/projects/:id/product-specs              → create
PUT    /api/projects/:id/product-specs/:psid        → update
DELETE /api/projects/:id/product-specs/:psid        → delete
POST   /api/projects/:id/product-specs/:psid/validate → returns checklist
```

### MCP (5 tools)
```
dtfs__list_product_specs(projectId)
dtfs__get_product_spec(productSpecId)
dtfs__create_product_spec(projectId, ...spec)
dtfs__update_product_spec(productSpecId, patch)
dtfs__validate_product_spec(productSpecId)
```

### Versioning

`ProductSpec` is now in `VERSIONED_MODELS`. Every create/update emits a
`Revision` linked to the active `ChangeSet`. Reverting is supported.

## Example — SAV app

User input :
> "Je veux une application SAV pour une marque e-commerce. Les clients
> peuvent créer une demande, joindre une photo, suivre le statut. Les
> agents peuvent traiter, rembourser ou clôturer. Les managers ont un
> dashboard de performance."

Expected output (abridged) :

```json
{
  "title": "SAV multi-rôle pour marque e-commerce",
  "description": "Application de service après-vente où les clients ouvrent des demandes (avec photo), les agents traitent / remboursent / clôturent, et les managers suivent les KPIs.",
  "domain": "support",
  "targetUsers": [
    { "kind": "primary", "label": "Client final", "needs": ["créer une demande rapidement", "suivre le statut", "joindre une photo"] },
    { "kind": "secondary", "label": "Agent SAV", "needs": ["voir la file", "traiter", "rembourser via Stripe", "clôturer"] },
    { "kind": "admin", "label": "Manager", "needs": ["dashboard temps moyen", "taux de remboursement"] }
  ],
  "goals": [
    { "kind": "USER", "title": "Créer une demande en < 60 secondes" },
    { "kind": "BUSINESS", "title": "Réduire le temps moyen de traitement de 30%" },
    { "kind": "TECHNICAL", "title": "Notifications email à chaque changement de statut" }
  ],
  "userJourneys": [
    {
      "name": "Création d'une demande",
      "steps": ["client se connecte", "ouvre demande", "upload photo", "soumet"],
      "happyPath": "Demande créée, email de confirmation envoyé",
      "edgeCases": ["photo > 10 Mo", "réseau interrompu pendant l'upload"]
    },
    { "name": "Traitement agent", "steps": ["agent ouvre la file", "réclame une demande", "communique", "rembourse ou clôture"], "happyPath": "Demande clôturée < 48h" },
    { "name": "Dashboard manager", "steps": ["accès URL admin", "vue KPI", "filtres par agent / période"], "happyPath": "KPIs à jour temps réel" }
  ],
  "businessObjects": [
    { "name": "Customer",   "attributes": [{"name":"email","type":"EMAIL"},{"name":"name","type":"TEXT"}] },
    { "name": "Ticket",     "attributes": [{"name":"customerId","type":"REL"},{"name":"status","type":"SELECT"},{"name":"photoAssetId","type":"REL?"}], "lifecycle": ["OPEN","IN_PROGRESS","REFUNDED","CLOSED"] },
    { "name": "Refund",     "attributes": [{"name":"ticketId","type":"REL"},{"name":"amount","type":"NUMBER"},{"name":"stripeChargeId","type":"TEXT"}] },
    { "name": "Agent",      "attributes": [{"name":"email","type":"EMAIL"},{"name":"role","type":"SELECT"}] }
  ],
  "businessRules": [
    { "id": "R-01", "statement": "Seul un agent peut changer le statut d'un ticket", "appliesTo": ["Ticket"], "priority": "MUST" },
    { "id": "R-02", "statement": "Un Refund > 200€ exige l'approbation du manager", "appliesTo": ["Refund"], "priority": "MUST" },
    { "id": "R-03", "statement": "Un ticket non touché pendant 7 jours est escaladé", "appliesTo": ["Ticket"], "priority": "SHOULD" }
  ],
  "openQuestions": [
    { "question": "Quel système de notification ? Email seulement, ou push aussi ?" },
    { "question": "Stripe pour le remboursement ou autre PSP ?" }
  ],
  "assumptions": [
    { "statement": "L'app a 3 rôles : Client / Agent / Manager", "confidence": "HIGH" },
    { "statement": "Les remboursements passent par Stripe", "confidence": "MEDIUM", "rationale": "Standard e-commerce, à confirmer" },
    { "statement": "Le dashboard manager est web-only", "confidence": "MEDIUM" }
  ]
}
```

## Phase 1 → Phase 2 transition

When the ProductSpec validation is complete (or the user accepts
incomplete state), the next step is **Phase 2 — Screen Understanding** :
the `dtfs-screen-analyst` agent takes the ProductSpec + any HTML
mockups and produces `ScreenSpec` rows.

The handoff payload :

```json
{
  "productSpecId": "<id>",
  "ready": true | false,
  "openQuestionsCount": <n>
}
```

Phase 2 is the next phase to implement — see future `PHASE_2.md`.
