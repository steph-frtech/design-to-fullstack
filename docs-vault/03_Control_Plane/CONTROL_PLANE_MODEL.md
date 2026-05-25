# Control Plane Model

Catalogue complet des concepts du Control Plane DTFS. Le Control Plane stocke les **définitions** d'une application full-stack — typées, validables, compilables vers du code réel. Chaque concept est scoped à un `Project`. Les mutations passent toutes par `ChangeSet → Revision`.

**Liens** : [[DELTA_SPEC]] · [[CHANGESET_REVISION]] · [[PROJECT_SPEC]] · [[BEHAVIOR_EXPANSION]] · [[EXPR_DSL]] · [[OPERATION_DSL]] · [[POLICY_DSL]]

## Source of truth

`backend/prisma/schema.prisma` · `docs/BACKEND_MODEL.md` · `docs/SCHEMA_INVENTORY.md`

## AI usage

Lire ce fichier en entier avant de produire un DeltaSpec. Ne jamais inventer de concept hors catalogue. Utiliser les noms exacts des champs JSON. Pour chaque concept : vérifier ses relations de dépendance (EntityRelation nécessite 2 × Entity existantes, Resource nécessite Entity, etc.).

## Status

Production — V1. Les concepts marqués "cible" n'existent pas encore en base.

---

## Couche 1 — Compréhension produit

### ProductSpec

**Purpose** : Compréhension haut niveau du produit en langage naturel. Source pour LLM avant de produire des concepts exécutables.

**Fields clés**

| Champ | Type | Obligatoire | Description |
|---|---|---|---|
| `title` | string | oui | Titre du produit |
| `description` | string | oui | Résumé en prose |
| `domain` | string? | non | Domaine métier |
| `targetUsers` | `Persona[]` | oui | `{ kind, label, needs[], frustrations[] }` |
| `goals` | `Goal[]` | oui | `{ kind: "USER"\|"BUSINESS"\|"TECHNICAL"; title; metric? }` |
| `nonGoals` | `string[]?` | non | Ce que le produit ne fait PAS |
| `personas` | `Persona[]?` | non | Personas détaillées |
| `userJourneys` | `UserJourney[]?` | non | `{ name; steps[]; happyPath; edgeCases[] }` |
| `businessObjects` | `BusinessObject[]?` | non | `{ name; attributes[]; relations[]; lifecycle }` |
| `businessRules` | `BusinessRule[]?` | non | `{ id; statement; appliesTo; priority }` |
| `glossary` | `GlossaryTerm[]?` | non | `{ term; definition; aliases? }` |

**Relationships** : `Project` (1→N) · `ScreenSpec[]` (1→N via `productSpecId`)

**Example JSON**

```json
{
  "title": "Todo Multi-User",
  "description": "Gestion de listes partagées entre membres d'une famille.",
  "domain": "productivity",
  "targetUsers": [{ "kind": "primary", "label": "Solo planner", "needs": ["organize tasks"], "frustrations": ["no offline"] }],
  "goals": [{ "kind": "USER", "title": "Create a private list in under 3 seconds" }],
  "nonGoals": ["No calendar integration in V1"]
}
```

**Generated impact** : Sert de contexte aux LLMs avant extraction de ScreenSpec / Requirement. Pas de compilation directe vers du code.

**Validation rules** : `title` et `description` non vides. `targetUsers` et `goals` doivent être des tableaux (vides autorisés).

---

### ScreenSpec

**Purpose** : Intent fonctionnel d'un écran unique — acteur, objectif, composants, données, actions, états — capturé AVANT tout HTML ou code.

**Fields clés**

| Champ | Type | Description |
|---|---|---|
| `name` | string | Nom humain de l'écran |
| `description` | string | Résumé fonctionnel |
| `actor` | string? | Rôle principal (ex. "Manager") |
| `purpose` | string? | Ce que l'écran permet d'accomplir |
| `userIntent` | string? | Pourquoi l'utilisateur arrive ici |
| `layoutHint` | string? | Indice de layout libre (ex. "dashboard 3-cards-grid") |
| `components` | `ScreenComponent[]?` | `{ kind, label?, description? }` |
| `actions` | `ScreenAction[]?` | `{ label, kind, target?, requiresAuth? }` |
| `dataNeeds` | `ScreenDataNeed[]?` | `{ entity, shape, filterBy?, realtime? }` |
| `businessRules` | `BusinessRule[]?` | Règles de validation spécifiques à cet écran |
| `emptyStates` / `errorStates` | `ScreenState[]?` | `{ trigger, message, cta? }` |

**Relationships** : `Project` (N→1) · `ProductSpec` (N→1 optionnel) · Mappage vers `Screen` via `RequirementMapping` (Layer 5 — pas de FK direct)

**Example JSON**

```json
{
  "name": "Dashboard",
  "description": "Vue principale listant toutes les listes de l'utilisateur",
  "actor": "Solo planner",
  "purpose": "Voir et gérer ses listes en un coup d'oeil",
  "dataNeeds": [{ "entity": "TodoList", "shape": "list", "filterBy": "ownerId" }],
  "actions": [{ "label": "New List", "kind": "form", "requiresAuth": true }]
}
```

**Generated impact** : Alimente `PlatformSpecProposal` (Phase 6) puis se traduit en `Screen`, `Component`, `Form` via DeltaSpec.

**Validation rules** : `name` et `description` non vides.

---

### Requirement

**Purpose** : Exigence discrète extraite des artefacts SDD (spec.md / tasks.md) ou saisie manuellement. Traceable via `RequirementMapping`.

**Fields clés** : `key` (ex. "REQ-001" — unique projet), `title`, `description`, `priority` (MUST/SHOULD/NICE/HIGH/CRITICAL), `status` (DRAFT→ACCEPTED→MAPPED), `acceptanceCriteria` (`{ given, when, then }[]`), `source` (natural/speckit/imported/manual)

**Relationships** : `Project` (N→1) · `ProductSpec` (N→1 optionnel) · `RequirementMapping[]` (1→N)

**Validation rules** : `key` unique par projet. `status` dans le cycle DRAFT→ACCEPTED→MAPPED→REJECTED.

---

### RequirementMapping

**Purpose** : Lien entre un `Requirement` et le concept plateforme qui le remplit. Un seul `Requirement` pointe typiquement vers plusieurs cibles (Entity + Operation + Screen + Policy + TestScenario).

**Fields clés** : `requirementId`, `targetType` (Entity/Operation/Policy/Screen/Field/TestScenario/Resource/Workflow/Component/Form), `targetId`, `confidence` (0.0–1.0), `rationale`

**Relationships** : `Requirement` (N→1)

---

### OpenQuestion

**Purpose** : Question non résolue qui bloque la génération de DeltaSpec tant qu'elle n'est pas ANSWERED ou DEFERRED.

**Fields clés** : `scope` (tag libre, ex. "screen:Dashboard"), `targetId?`, `question`, `answer?`, `status` (OPEN/ANSWERED/DEFERRED)

---

### Assumption

**Purpose** : Déclaration que le système croit vraie mais non validée. Bloque la génération de DeltaSpec jusqu'à ACCEPTED ou REJECTED.

**Fields clés** : `scope`, `targetId?`, `text`, `status` (OPEN/ACCEPTED/REJECTED)

---

### SpecArtifact

**Purpose** : Artefact Markdown d'un flux Spec-Driven Development (Spec Kit). Un `kind` par artefact : constitution/spec/plan/tasks/research/data-model/quickstart/platform-mapping/contracts/notes.

**Fields clés** : `kind` (string libre), `featureKey?` (null = projet entier), `path?` (chemin disque relatif), `content` (Markdown), `contentHash`, `source` (generated/speckit/manual)

**Relationships** : `Project` (N→1)

---

## Couche 2 — Modèle de données

### Entity

**Purpose** : Forme d'un objet domaine. N'expose rien par elle-même — c'est le `Resource` qui l'expose.

**Fields clés** : `name` (technique, ex. "Contact"), `nameKey?` (clé i18n)

**Relationships** : `Project` (N→1) · `Attribute[]` · `EntityRecord[]` · `EntityRelation[]` (from/to) · `Resource[]` · `Behavior[]` · `Policy[]`

**Example JSON**

```json
{ "name": "TodoList", "nameKey": "entity.todo_list.label" }
```

**Generated impact** : Génère une table SQL, un modèle Prisma, un schéma Zod dans le SharedContract.

**Validation rules** : `name` unique par projet. PascalCase recommandé.

---

### Attribute

**Purpose** : Champ d'une Entity. Type fermé via enum `FieldType`.

**Fields clés** : `entityId`, `name`, `type` (FieldType), `required`, `unique`, `config` (JSON shape spécifique par type)

**FieldType catalogue** : TEXT, TEXTAREA, EMAIL, PASSWORD, NUMBER, DATE, DATETIME, TIME, CHECKBOX, RADIO, SELECT, MULTISELECT, FILE, RICHTEXT, COLOR, RANGE, HIDDEN, CUSTOM

**Example JSON**

```json
{ "entityName": "TodoList", "name": "title", "type": "TEXT", "required": true }
```

**Generated impact** : Génère une colonne SQL + champ Prisma + propriété Zod.

**Validation rules** : `name` unique par Entity. `type` doit être une valeur de `FieldType`.

---

### EntityRelation

**Purpose** : Relation asymétrique entre deux Entities. Le côté `from` porte la FK. Pilote la génération de FK SQL, les joins Prisma, et les règles de cascade.

**Fields clés**

| Champ | Description |
|---|---|
| `fromEntityId` | Entity qui porte la FK |
| `toEntityId` | Entity référencée |
| `name` | Nom dans le code généré (ex. "list", "items", "owner") |
| `kind` | ONE_TO_ONE / ONE_TO_MANY / MANY_TO_MANY |
| `fromField` | Champ FK sur le côté from (auto-créé si absent) |
| `toField` | Champ référencé côté to (défaut : `id`) |
| `required` | FK nullable ou non |
| `cascade` | `{ onDelete: "CASCADE"\|"SET_NULL"\|"RESTRICT" }` |

**Example JSON**

```json
{
  "fromEntityName": "TodoItem",
  "toEntityName": "TodoList",
  "name": "list",
  "kind": "ONE_TO_MANY",
  "required": true,
  "cascade": { "onDelete": "CASCADE" }
}
```

**Generated impact** : FK SQL + Prisma relation + join automatique dans les operations read.

**Validation rules** : `fromEntityId` et `toEntityId` doivent appartenir au même projet.

---

## Couche 3 — Exposition API et logique métier

### Resource

**Purpose** : Exposition CRUD d'une Entity via HTTP. 0 ou 1 Resource par Entity (private vs public).

**Fields clés**

| Champ | Description |
|---|---|
| `name` | kebab-case pluriel (ex. "todo-lists") |
| `exposedOps` | Sous-ensemble de ["list","read","create","update","delete"] |
| `queryConfig` | `{ pagination?, sort?, filter?, search? }` |
| `defaultPolicyId` | Policy appliquée à toutes les ops (sauf override) |

**QueryConfig shape**

```ts
{
  pagination?: { kind: "offset"|"cursor"; default: number; max: number }
  sort?:       { allowed: string[]; default?: string[] }
  filter?:     { field: string; operators: ("eq"|"in"|"contains"|"gt"|"gte"|"lt"|"lte")[] }[]
  search?:     { fields: string[]; mode: "ilike"|"fulltext"|"external" }
}
```

**Relationships** : `Entity` (N→1) · `Policy[]` (ResourcePolicies + ResourceDefaultPolicy)

**Example JSON**

```json
{
  "entityName": "TodoList",
  "name": "todo-lists",
  "exposedOps": ["list", "read", "create", "update", "delete"],
  "queryConfig": { "pagination": { "kind": "offset", "default": 20, "max": 100 } }
}
```

**Generated impact** : Génère les routes Hono REST + Prisma queries dans le BackendContract.

**Validation rules** : `name` unique par projet. `entityId` doit pointer sur une Entity du projet. `defaultPolicyId` doit pointer sur une Policy du projet.

---

### Operation

**Purpose** : LE concept qui rend le vibe-coding déterministe. Verbe backend explicite avec I/O typé et corps en Step DSL — pas de code libre.

**Fields clés**

| Champ | Description |
|---|---|
| `name` | camelCase (ex. "createTodoList") |
| `kind` | QUERY (read-only) ou COMMAND (mutations/side-effects). WORKFLOW réservé V3. |
| `inputSchema` | JSON Schema des inputs (Zod-dérivable) |
| `outputSchema` | JSON Schema des outputs (optionnel pour COMMAND, requis pour QUERY) |
| `reads` | `string[]` — noms des entities lues |
| `writes` | `string[]` — noms des entities écrites |
| `steps` | `OperationStep[]` — corps via Step DSL |
| `bodyHint` | Pseudo-code humain — informatif seulement, jamais interprété |

**Relationships** : `Project` (N→1) · `Form[]` · `Trigger[]` · `Policy[]`

**Example JSON**

```json
{
  "name": "createTodoList",
  "kind": "COMMAND",
  "inputSchema": { "type": "object", "required": ["title"], "properties": { "title": { "type": "string" } } },
  "reads": [],
  "writes": ["TodoList"],
  "steps": [
    { "kind": "authorize", "policy": "authenticated-only" },
    { "kind": "mutate", "op": "create", "entity": "TodoList", "data": { "obj": { "title": { "ref": "$.input.title" } } }, "as": "list" },
    { "kind": "return", "value": { "ref": "$.list" } }
  ]
}
```

**Generated impact** : Génère une route Hono + handler Prisma + types TypeScript dans le BackendContract. Les `steps` se compilent en code impératif lors du codegen.

**Validation rules** : `name` unique par projet. `reads`/`writes` doivent référencer des Entities connues. `steps` validés via `validateOperationBody`. `kind=WORKFLOW` ne doit pas être utilisé en V1.

---

### Policy

**Purpose** : Règle d'autorisation. Compilable vers 3 cibles : middleware Hono (V1), clause where Prisma (V1), DDL Postgres RLS (V2).

**Fields clés**

| Champ | Description |
|---|---|
| `name` | Identifiant dans les steps (ex. "authenticated-only") |
| `scope` | RESOURCE / OPERATION / ENTITY / FIELD |
| `resourceId?` | Requis si scope=RESOURCE |
| `operationId?` | Requis si scope=OPERATION |
| `entityId?` | Requis si scope=ENTITY ou FIELD |
| `fieldName?` | Requis si scope=FIELD |
| `effect` | ALLOW (défaut) ou DENY |
| `rule` | Arbre PolicyRule (voir [[POLICY_DSL]]) |

**Example JSON**

```json
{
  "name": "is-todo-list-owner",
  "scope": "ENTITY",
  "entityName": "TodoList",
  "effect": "ALLOW",
  "rule": {
    "all": [
      { "exists": { "ref": "$.auth.userId" } },
      { "eq": [{ "ref": "$.auth.userId" }, { "ref": "$.record.ownerId" }] }
    ]
  }
}
```

**Generated impact** : Middleware Hono avant invocation d'Operation + filtre where sur les queries Resource.

**Validation rules** : `name` unique par projet. `scope=ENTITY` requiert `entityId`. `rule` validé via `validatePolicyRule`.

---

### Integration

**Purpose** : Connexion nommée à un service externe. Les secrets NE VIVENT PAS ici — `secretRefs` pointe sur des vars d'env ou un secret store.

**Fields clés** : `key` (nom local, ex. "email"), `provider` (ex. "sendgrid"), `capabilities` (`string[]`, ex. ["email.send"]), `configSchema`, `secretRefs` (`{ apiKey: "env:SENDGRID_API_KEY" }`)

**Example JSON**

```json
{
  "key": "email",
  "provider": "sendgrid",
  "capabilities": ["email.send"],
  "secretRefs": { "apiKey": "env:SENDGRID_API_KEY" }
}
```

**Generated impact** : Génère un module d'intégration appelable depuis les steps `callIntegration`.

**Validation rules** : `key` unique par projet. Dans les steps, `capability` doit être dans le tableau `capabilities` déclaré.

---

### Trigger

**Purpose** : Cause non-humaine qui déclenche une Operation. Les soumissions de formulaires UI passent par `Form.operationId` — pas par Trigger.

**Fields clés** : `name`, `kind` (EVENT/SCHEDULE/WEBHOOK), `source` (shape par kind — voir ci-dessous), `operationId`, `inputMapping` (JSONata mapping source→input)

**Source shapes**

```jsonc
// EVENT
{ "event": "order.paid" }
// SCHEDULE
{ "cron": "0 0 * * *" }
// WEBHOOK
{ "path": "/webhooks/stripe", "method": "POST", "verify": "stripe-signature" }
```

**Validation rules** : `name` unique par projet. `operationId` doit pointer sur une Operation du projet (kind QUERY ou COMMAND — pas WORKFLOW).

---

### Workflow

**Purpose** : Processus orchestré longue durée. V1 placeholder — runtime Temporal arrive avec le codegen V3.

**Fields clés** : `name`, `inputSchema`, `steps` (shape à formaliser dans Workflow DSL), `durability` (`{ retry, timeout, compensation }`), `bodyHint`

**Status** : V1 — modèle présent, apply DeltaSpec = `not_implemented_yet`, pas de runtime.

---

### Behavior

**Purpose** : Macro composable sur une Entity. Doit toujours s'expandre en Resources/Operations/Policies avant le codegen.

**Fields clés** : `entityId`, `kind` (catalogue fermé V1 — voir [[BEHAVIOR_EXPANSION]]), `config` (shape par kind)

**Catalogue V1** : ownable · soft-deletable · publishable · taggable · searchable · shareable · auditable · versioned · commentable · attachable · localizable

**Generated impact** : Via `POST /spec/expand-behaviors/delta` → DeltaSpec avec attributes/policies/operations/testScenarios.

**Validation rules** : `kind` doit être dans le catalogue V1 frozen. `entityId` doit appartenir au projet.

---

## Couche 4 — Sécurité et runtime

| Concept | Purpose | Fields clés | Status |
|---|---|---|---|
| **AuthMethod** | Méthode d'auth déclarée pour l'app générée | `name`, `kind` (SESSION/BEARER/HMAC/APIKEY — note: doublon APIKEY/API_KEY à corriger cf. AUDIT_REPORT), `config`, `isDefault` | V1 — apply `not_implemented_yet` |
| **Secret** | Pointeur vers un secret (valeur jamais stockée ici) | `key`, `vault` (`{ kind: "env"; var: "STRIPE_SECRET_KEY" }`), `refKind` (ENV/VAULT), `path?` | V1 |
| **Environment** | Overrides par environnement (dev/staging/prod) | `name`, `overrides` (`{ secrets, vars }`), `config?` | V1 |
| **AppRole** | Rôle RBAC de l'app générée | `key`, `label`, `permissions` (`string[]` de capability keys) | V1 |
| **EventDefinition** | Événement interne que le système émet | `name`, `payloadSchema` (JSON Schema), `description?`, `source?` | V1 |

---

## Couche 5 — Définitions UI

| Concept | Purpose | Fields clés | Status |
|---|---|---|---|
| **Screen** | Route/page de l'app générée | `path` (ex. "/contact"), `type?` (web/mobile/desktop), `titleKey?`, `order` | V1 |
| **Component** | Noeud UI dans l'arbre d'une Screen | `screenId?`, `parentId?`, `type` (form/table/text/image/container/…), `config` (className, props) | V1 |
| **Form** | Formulaire lié à un Component | `componentId`, `operationId?` (préféré), `entityId?` (legacy), `inputMapping`, `onSuccess`, `onError`, `submitKey` | V1 |
| **Field** | Champ de saisie dans un Form | `formId`, `name`, `type` (FieldType), `required`, `labelKey?`, `placeholderKey?`, `config` | V1 |
| **Action** | Action déclarative UI (bouton, navigation) | `kind` (submit/navigate/callOperation/…), `targetType`, `targetId?`, `data` | V1 — apply `not_implemented_yet` |
| **DataBinding** | Liaison données → composant | `source` (`{ kind: "Resource"\|"Operation"\|"Entity"; ref }`) `query`, `componentId?` | V1 — apply `not_implemented_yet` |
| **Translation** | Valeur i18n pour une TextKey + Locale | `textKeyId`, `localeId`, `value` | V1 |
| **Theme** | Tokens de design (couleurs, typo, spacing) | `projectId`, `tokens` (JSON) | V1 |

---

## Couche 6 — Versioning et audit

### ChangeSet

**Purpose** : Groupe logique de Revisions (style commit git). Chaque mutation appartient à un ChangeSet.

**Fields clés** : `message`, `actorId?`, `status` (DRAFT→APPLIED→REVERTED), `parentId?`, `revertOfId?`, `revertedById?`, `appliedAt?`

**Relationships** : `Revision[]` · `GeneratedArtifact[]`

Voir [[CHANGESET_REVISION]] pour le flux complet.

---

### Revision

**Purpose** : Snapshot atomique par ligne + diff de champs. Auto-émis sur chaque mutation via l'extension Prisma.

**Fields clés** : `entityType` (nom du modèle), `entityId`, `version`, `op` (CREATE/UPDATE/DELETE/RESTORE), `data` (snapshot post-mutation), `diff` (`{ field: [before, after] }`), `actorId?`, `changeSetId?`

**Validation rules** : Unique sur `(entityType, entityId, version)`. Append-only — jamais modifié.

---

## Couche 7 — Codegen et déploiement

| Concept | Purpose | Fields clés | Status |
|---|---|---|---|
| **RuntimeTarget** | Stack technique pour le codegen (ex. "hono-next") | `name`, `backend` (Json), `frontend` (Json), `auth` (Json), `database` (Json), `packageManager?`, `runtime?` | V1 — voir [[SPEC_KIT_INTEGRATION]] |
| **BackendContract** | Contrat de toutes les routes API | `apiBasePath`, `routes` (Json), `schemas`, `middlewares?`, `auth?` | V1 — artefact régénéré |
| **FrontendContract** | Contrat de toutes les pages/composants | `routes`, `pages`, `layouts?`, `components`, `forms`, `dataBindings`, `actions`, `authGuards?` | V1 — artefact régénéré |
| **SharedContract** | Types partagés backend↔frontend | `types`, `schemas`, `apiClient?`, `errors?`, `events?` | V1 — artefact régénéré |
| **GeneratedArtifact** | Fichier produit par le codegen | `kind`, `path`, `content`, `hash`, `changeSetId?`, `artifactKind` (CODE/MIGRATION/ASSET/TEST/DOCS) | V1 |
| **DeploymentTarget** | Cible de déploiement | `name`, `kind` (local/vercel/fly/docker/custom), `config`, `targetKind` (DEV/STAGING/PRODUCTION) | V1 |
| **TestScenario** | Scénario de test déclaratif | `name`, `operationId?`, `scenarioKind` (UNIT/INTEGRATION/E2E), `inputs`, `expected`, `mocks`, `steps?` | V1 — apply `not_implemented_yet` |
| **AuditLog** | Trail d'audit runtime (append-only) | `kind`, `detail`, `actorId?`, `entityType?`, `entityId?` | V1 |
| **RuntimeInstance** | Instance déployée en cours d'exécution | *(champs à définir)* | **CIBLE — n'existe pas encore en base** |

---

## Couche 8 — Spec Kit (cadrage fonctionnel)

| Concept | Purpose | Voir |
|---|---|---|
| **ProductSpec** | Compréhension produit (couche 1) | ci-dessus |
| **ScreenSpec** | Spec d'écran (couche 1) | ci-dessus |
| **OpenQuestion** | Question bloquante | ci-dessus |
| **Assumption** | Hypothèse à valider | ci-dessus |
| **SpecArtifact** | Artefact Markdown Spec Kit | ci-dessus |
| **PlatformSpecProposal** | Synthèse read-only (Phase 6) avant DeltaSpec | Champs : `proposal` (Json), `warnings`, `assumptions`, `openQuestions`, `confidenceScore`, `status` (DRAFT/ACCEPTED/REJECTED/APPLIED), `appliedChangeSetId?` |

---

## Récapitulatif des contraintes d'intégrité croisée

- `Form.operationId` → Operation du même projet.
- `Trigger.operationId` → Operation (kind ∈ QUERY/COMMAND, pas WORKFLOW).
- `Resource.entityId` → Entity du même projet.
- `Resource.defaultPolicyId` → Policy du même projet.
- `Behavior.kind` → Catalogue V1 frozen.
- `Step.entity` (read/mutate) → Entity name connue du projet.
- `Step.policy` (authorize) → Policy name connue du projet.
- `Step.integration` (callIntegration) → Integration key + capability déclarées.
- `Policy.scope=ENTITY` → `entityId` requis.
- `EntityRelation.fromEntityId` et `toEntityId` → même projet.
