# Phase 6 — PlatformSpec Proposal

Phase 6 produit une **proposition** structurée du modèle plateforme
*avant* toute écriture dans le Control Plane. C'est l'étape de revue qui
permet à un humain (ou un autre agent) de relire la synthèse complète
avant de la matérialiser via `apply_spec` (Phase 7+).

> Cette étape ne modifie RIEN dans le Control Plane.
> Sortie : **proposal · warnings · assumptions · openQuestions · confidenceScore**.

## Modèle

```prisma
model PlatformSpecProposal {
  id, projectId, featureKey String?,
  proposal Json,                          // gros document JSON typé
  warnings Json @default("[]"),           // { code, message, target?, severity }[]
  assumptions Json @default("[]"),        // { statement, confidence }[]
  openQuestions Json @default("[]"),      // { question, blockedBy? }[]
  confidenceScore Float?,                  // 0.0–1.0
  status String @default("DRAFT"),         // DRAFT | ACCEPTED | REJECTED | APPLIED
  rationale String?,
  appliedChangeSetId String?,             // si APPLIED
  currentVersion Int,
  createdAt, updatedAt
}
```

## Statuts

| Status     | Sémantique                                              |
|------------|---------------------------------------------------------|
| `DRAFT`    | Brouillon — peut être édité (PUT) jusqu'à acceptation   |
| `ACCEPTED` | Validé par l'utilisateur, prêt à être appliqué          |
| `REJECTED` | Refusé (avec `rationale`)                                |
| `APPLIED`  | Un DeltaSpec/ChangeSet a été généré ; `appliedChangeSetId` peuplé |

## Structure du `proposal` JSON

Top-level — chaque clé est un array de descriptors :

```ts
type ProposalContents = {
  entities?:      { name, description?, behaviors? }[];
  attributes?:    { entity, name, type, required?, unique?, config? }[];
  relations?:     { from, to, name, kind, fromField?, required? }[];
  resources?:     { entity, name?, exposedOps, queryConfig? }[];
  operations?:    { name, kind, inputSchema, outputSchema?, reads?, writes?, steps, bodyHint? }[];
  policies?:      { name, scope, resource?, operation?, entity?, fieldName?, effect?, rule }[];
  screens?:       { path, type?, titleKey? }[];
  components?:    { kind, screenPath?, parentRef?, config? }[];
  forms?:         { componentRef, operationName?, inputMapping? }[];
  fields?:        { formRef, name, type, required?, labelKey? }[];
  actions?:       { kind, componentRef?, targetType, targetId?, data? }[];
  dataBindings?:  { componentRef?, source, query? }[];
  assets?:        { mimeType, entity?, attributeName?, note? }[];
  authMethods?:   { name, kind, config }[];
  events?:        { name, payloadSchema? }[];
  testScenarios?: { name, operation?, screen?, inputs?, expected? }[];
  workflows?:     { name, inputSchema, steps }[];
  triggers?:      { name, kind, source, operationName? }[];
  integrations?:  { key, provider, capabilities, configSchema? }[];
  behaviors?:     { entity, kind, config? }[];
};
```

Chaque entrée est un "to-create". Phase 7+ traduira en DeltaSpec.

## Synthesizer

`buildProposalSkeleton({ projectId, featureKey? })` :

1. Snapshot existant : `Entity[]`, `Operation[]`, `ScreenSpec[]`, `Requirement[]`.
2. Pour chaque Requirement in-scope sans mapping → `openQuestion`.
3. Pour chaque ScreenSpec sans Screen équivalent → `warning screen_spec_unmapped`.
4. Retourne une enveloppe avec proposal vide, warnings/openQuestions
   peuplés, `confidenceScore: 0.5` par défaut.

L'agent enrichit ensuite via `PUT /api/projects/:id/platform-proposals/:ppid`.

## Validation statique

`validateProposalEnvelope(envelope, existingEntities, existingOps)` :

| Check                    | Severity | Trigger                                                     |
|--------------------------|----------|-------------------------------------------------------------|
| `empty`                  | warn     | 0 creates au total                                          |
| `duplicate_name`         | error    | Même nom 2× dans un bucket                                   |
| `missing_entity`         | error    | Operation/Attribute ref une entity inconnue                  |
| `missing_operation`      | error    | Trigger ref une operation inconnue                           |
| `low_confidence`         | warn     | `confidenceScore < 0.3`                                      |
| `ok`                     | info     | Aucun problème statique détecté                              |

Pas de DB write — pur lint JSON.

## API surface

### HTTP
```
GET    /api/projects/:id/platform-proposals?status=&featureKey=
GET    /api/projects/:id/platform-proposals/:ppid
POST   /api/projects/:id/platform-proposals               { featureKey?, proposal, ... }
PUT    /api/projects/:id/platform-proposals/:ppid         (patch)
DELETE /api/projects/:id/platform-proposals/:ppid
POST   /api/projects/:id/platform-proposals/:ppid/accept  { rationale? }
POST   /api/projects/:id/platform-proposals/:ppid/reject  { rationale? }
POST   /api/projects/:id/platform-proposals/synthesize    { featureKey? } → skeleton + id
POST   /api/projects/:id/platform-proposals/:ppid/validate → checks
```

### MCP (7 tools)
```
dtfs__propose_platform_spec(projectId, featureKey?)
dtfs__map_screens_to_platform(projectId, featureKey?)
dtfs__list_platform_proposals(projectId, status?)
dtfs__get_platform_proposal(proposalId)
dtfs__accept_platform_proposal(proposalId, rationale?)
dtfs__reject_platform_proposal(proposalId, rationale?)
dtfs__validate_platform_proposal(proposalId)
```

(`dtfs__map_requirements_to_platform` de Phase 5 reste utilisé.)

## Versioning

`PlatformSpecProposal` est dans `VERSIONED_MODELS` ET
`MODELS_WITH_CURRENT_VERSION`. Chaque PUT bump `currentVersion` et émet
une Revision liée au ChangeSet courant.

## Agent

`dtfs-platform-mapper` étendu Phase 6 :
1. (existant) Mapping des Requirements vers cibles Control Plane.
2. Pour les cibles inexistantes : ouvre une OpenQuestion.
3. **Synthèse** : `propose_platform_spec` → skeleton DRAFT.
4. **Enrichissement** : PUT le proposal pour remplir entities / operations
   / policies / screens / etc. avec Step DSL + PolicyRule + JSON Schemas.
5. **Validation** : `validate_platform_proposal` → résout les errors.
6. **Rapport** : proposalId + confidence + top warnings/questions.

L'agent **ne change pas** le status à ACCEPTED — c'est l'utilisateur.

## Slash command

`/dtfs:propose-platform [featureKey]` — lance Phase 6.

## Exemple — feature `001-support`

`/dtfs:propose-platform 001-support` produit :

```jsonc
{
  "id": "ppropos_…",
  "status": "DRAFT",
  "confidenceScore": 0.75,
  "proposal": {
    "entities":   [{"name":"SupportTicket","behaviors":["ownable"]}, {"name":"Refund"}],
    "attributes": [
      {"entity":"SupportTicket","name":"status","type":"SELECT","required":true},
      {"entity":"Refund","name":"amount","type":"NUMBER","required":true}
    ],
    "relations": [
      {"from":"Refund","to":"SupportTicket","name":"ticket","kind":"ONE_TO_MANY","fromField":"ticketId"}
    ],
    "operations": [
      {
        "name": "createSupportTicket",
        "kind": "COMMAND",
        "inputSchema": {...},
        "writes": ["SupportTicket"],
        "steps": [
          {"kind":"authorize","policy":"customerCanCreateOwnTicket"},
          {"kind":"mutate","op":"create","entity":"SupportTicket","data":"...","as":"ticket"},
          {"kind":"return","value":"$.ticket"}
        ]
      }
    ],
    "policies": [
      {"name":"customerCanCreateOwnTicket","scope":"OPERATION","effect":"ALLOW","rule":{"exists":"$.auth.user.id"}}
    ],
    "testScenarios": [
      {"name":"customer_create_ticket_success","operation":"createSupportTicket","expected":{"ok":true}}
    ]
  },
  "warnings": [{"code":"screen_spec_unmapped","severity":"info","message":"..."}],
  "openQuestions": [{"question":"REQ-005 needs sendPushNotification — create ?"}],
  "assumptions": [{"statement":"Status default OPEN at create","confidence":"HIGH"}]
}
```

L'utilisateur revoit, puis :
```
POST /api/projects/:id/platform-proposals/:ppid/accept
  { "rationale": "Review OK." }
```

Status passe à ACCEPTED. Conversion → DeltaSpec/ChangeSet : Phase 7.

## Hors scope Phase 6

- **Application automatique** Proposal → DeltaSpec → ChangeSet : V1 manuel.
- **Peuplement de `appliedChangeSetId`** : Phase 7 quand `apply_spec`
  acceptera un `proposalId`.
- **Diff Proposal vs état réel** : pas d'endpoint dédié.
- **UI éditeur** : pas en V1.

## Phase 6 → Phase 7

`status === ACCEPTED` → prêt pour traduction en DeltaSpec. Phase 7 prendra
le `proposal` et compilera en `creates/updates/deletes` par concept, puis
appliquera dans un ChangeSet nommé d'après le `featureKey`.
