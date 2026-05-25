## Phase 7 — DeltaSpec canonique
Objectif

Transformer la proposition en modifications atomiques.

Le DeltaSpec est le seul format autorisé pour modifier le Control Plane.

Type cible
type DeltaSpec = {
  productSpecs?: DeltaBlock<ProductSpecInput, ProductSpecPatch, ProductSpecRef>
  screenSpecs?: DeltaBlock<ScreenSpecInput, ScreenSpecPatch, ScreenSpecRef>
  requirements?: DeltaBlock<RequirementInput, RequirementPatch, RequirementRef>

  entities?: DeltaBlock<EntityInput, EntityPatch, EntityRef>
  attributes?: DeltaBlock<AttributeInput, AttributePatch, AttributeRef>
  relations?: DeltaBlock<RelationInput, RelationPatch, RelationRef>
  resources?: DeltaBlock<ResourceInput, ResourcePatch, ResourceRef>
  operations?: DeltaBlock<OperationInput, OperationPatch, OperationRef>
  policies?: DeltaBlock<PolicyInput, PolicyPatch, PolicyRef>
  workflows?: DeltaBlock<WorkflowInput, WorkflowPatch, WorkflowRef>
  triggers?: DeltaBlock<TriggerInput, TriggerPatch, TriggerRef>
  integrations?: DeltaBlock<IntegrationInput, IntegrationPatch, IntegrationRef>
  assets?: DeltaBlock<AssetInput, AssetPatch, AssetRef>
  authMethods?: DeltaBlock<AuthMethodInput, AuthMethodPatch, AuthMethodRef>

  screens?: DeltaBlock<ScreenInput, ScreenPatch, ScreenRef>
  components?: DeltaBlock<ComponentInput, ComponentPatch, ComponentRef>
  forms?: DeltaBlock<FormInput, FormPatch, FormRef>
  fields?: DeltaBlock<FieldInput, FieldPatch, FieldRef>
  actions?: DeltaBlock<ActionInput, ActionPatch, ActionRef>
  dataBindings?: DeltaBlock<DataBindingInput, DataBindingPatch, DataBindingRef>

  testScenarios?: DeltaBlock<TestScenarioInput, TestScenarioPatch, TestScenarioRef>
}
type DeltaBlock<Create, Update, Ref> = {
  create?: Create[]
  update?: Update[]
  delete?: Ref[]
}
Règle absolue

Aucun agent ne modifie directement la base.

Tout passe par :

DeltaSpec
→ validate_spec
→ apply_spec
→ ChangeSet
MCP tools
dtfs__create_delta_from_platform_proposal
dtfs__validate_delta_spec
dtfs__explain_delta_spec
Livrable
Un langage unique de modification.
## Phase 8 — Expr DSL
Objectif

Remplacer toutes les expressions libres par un AST JSON typé.

Type
export type Expr =
  | { lit: string | number | boolean | null }
  | { ref: string }
  | { call: string; args: Expr[] }
  | { obj: Record<string, Expr> }
  | { arr: Expr[] }
Fonctions autorisées
export const EXPR_FUNCTIONS = {
  lowercase: { args: 1, pure: true },
  uppercase: { args: 1, pure: true },
  trim: { args: 1, pure: true },
  concat: { args: -1, pure: true },
  length: { args: 1, pure: true },
  now: { args: 0, pure: false },
  uuid: { args: 0, pure: false },
  randomToken: { args: 0, pure: false },
}
Roots autorisées
$.input
$.auth
$.record
$.records
$.system
$.env
$.params
$.query
$.<stepAlias>
À coder
validateExpr
evalExpr
collectExprRefs
collectExprCalls
inferExprType
Livrable
Plus de string magique.
Plus de JSONata fragile.
Le LLM produit du JSON typé.
## Phase 9 — Operation DSL et Policy DSL
Objectif

Décrire le comportement backend sans écrire encore le code.

Operation
Operation.kind = QUERY | COMMAND

Pas de WORKFLOW dans Operation.kind.

OperationStep
type OperationStep =
  | { kind: "validate"; schema: JsonSchema }
  | { kind: "authorize"; policy: string }
  | { kind: "read"; entity: string; where?: Expr; many?: boolean; as: string }
  | { kind: "mutate"; op: "create" | "update" | "delete"; entity: string; data?: Expr; where?: Expr; as?: string }
  | { kind: "callIntegration"; integration: string; capability: string; input: Expr; as?: string }
  | { kind: "emitEvent"; event: string; payload: Expr }
  | { kind: "branch"; if: Expr; then: OperationStep[]; else?: OperationStep[] }
  | { kind: "assert"; condition: Expr; message: string }
  | { kind: "log"; level: "info" | "warn" | "error"; message: Expr }
  | { kind: "return"; value: Expr }
PolicyRule
type PolicyRule =
  | { all: PolicyRule[] }
  | { any: PolicyRule[] }
  | { not: PolicyRule }
  | { eq: [Expr, Expr] }
  | { neq: [Expr, Expr] }
  | { in: [Expr, Expr] }
  | { gt: [Expr, Expr] }
  | { gte: [Expr, Expr] }
  | { lt: [Expr, Expr] }
  | { lte: [Expr, Expr] }
  | { exists: Expr }
  | { matches: [Expr, string] }
Livrable
Le comportement back est générable, validable et testable.
## Phase 10 — Modèle Prisma enrichi
Objectif

Ajouter tous les concepts nécessaires à une vraie app full-stack.

À ajouter
Workflow
Asset
AuthMethod
Secret
Environment
AppRole
EventDefinition
Action
DataBinding
GeneratedArtifact
DeploymentTarget
TestScenario
AuditLog
Points importants
Workflow

V1 placeholder, runtime plus tard.

Asset

Pour images, documents, pièces jointes.

AuthMethod

Pour session, bearer, HMAC, API key.

Secret

Pour ne jamais mettre de secret en clair dans la spec.

Action

Pour relier un bouton UI à une Operation ou une navigation.

DataBinding

Pour relier un composant à une source de données.

GeneratedArtifact

Pour tracer les fichiers générés.

Livrable
Le schéma couvre le produit, le front, le back, la sécurité, les assets, les tests et le codegen.
## Phase 11 — ChangeSet et Revision
Objectif

Toute modification doit être reversible.

Flux obligatoire
begin_changeset
→ validate_spec
→ apply_spec
→ commit_changeset

ou :

discard_changeset
Modèles
ChangeSet
Revision
Fonctions
beginChangeSet
validateDeltaSpec
applyDeltaSpec
commitChangeSet
discardChangeSet
revertChangeSet
revertRevision
revertField
getSpecAt
diffChangeSets
Gate obligatoire
pas de ChangeSet ouvert
= pas d’écriture
Livrable
Historique propre.
Rollback fiable.
Diff lisible.
## Phase 12 — API HTTP Control Plane
Objectif

Exposer le Control Plane indépendamment du MCP.

Endpoints principaux
GET    /api/projects
GET    /api/projects/:id/spec.json
GET    /api/projects/:id/spec.md

POST   /api/projects/:id/product-spec/from-prompt
POST   /api/projects/:id/screen-spec/from-prompt
POST   /api/projects/:id/sdd/generate
POST   /api/projects/:id/platform/propose
POST   /api/projects/:id/delta/from-proposal

POST   /api/projects/:id/changesets
POST   /api/projects/:id/validate
POST   /api/projects/:id/apply

POST   /api/changesets/:id/commit
POST   /api/changesets/:id/discard
POST   /api/changesets/:id/revert

GET    /api/projects/:id/changesets
GET    /api/changesets/:id
GET    /api/projects/:id/revision-at
GET    /api/projects/:id/diff
Livrable
Le backend est utilisable sans Claude Code.
## Phase 13 — MCP Server minimal
Objectif

Donner à Claude Code des tools sûrs.

Tools phase MVP
dtfs__list_projects
dtfs__get_project_spec
dtfs__describe_concept
dtfs__list_expr_functions
dtfs__list_behaviors

dtfs__create_product_spec_from_prompt
dtfs__create_screen_spec_from_prompt
dtfs__list_open_questions
dtfs__answer_open_question

dtfs__generate_sdd_artifacts
dtfs__sync_speckit_artifacts
dtfs__validate_sdd_artifacts

dtfs__propose_platform_spec
dtfs__create_delta_from_platform_proposal
dtfs__validate_spec
dtfs__explain_delta_spec

dtfs__begin_changeset
dtfs__apply_spec
dtfs__commit_changeset
dtfs__discard_changeset
dtfs__revert_changeset
Règle

Le MCP ne doit pas contenir de logique métier lourde.
Il enveloppe l’API HTTP.

Livrable
Claude Code peut piloter la plateforme sans accès direct DB.
## Phase 14 — Import HTML / Figma / maquette
Objectif

Ajouter une autre entrée possible après la description naturelle.

HTML
Figma
screenshot
maquette
Pipeline
HTML/Figma
→ HtmlAnalysis / DesignAnalysis
→ comparaison avec ScreenSpec
→ delta UI
→ PlatformSpecProposal
→ DeltaSpec
Tools
dtfs__analyze_html
dtfs__diff_html
dtfs__import_html_proposal
dtfs__analyze_figma
dtfs__import_design_proposal
Important

L’import HTML ne remplace pas le ScreenSpec.

Il vient enrichir ou corriger :

ScreenSpec
Screen
Component
Field
Action
DataBinding
Asset
Livrable
On peut partir d’une description naturelle ou d’un écran existant.
## Phase 15 — Harness Claude Code MVP
Objectif

Créer le cockpit Claude Code.

Agents MVP
dtfs-product-analyst
dtfs-screen-spec-writer
dtfs-question-manager
dtfs-sdd-writer
dtfs-platform-mapper
dtfs-spec-writer
dtfs-spec-validator
dtfs-diff-explainer
Skills
dtfs-describe-app
dtfs-describe-screen
dtfs-questions
dtfs-generate-spec
dtfs-map-to-platform
dtfs-propose-changes
dtfs-validate
dtfs-apply
dtfs-revert
dtfs-status
Slash commands
/dtfs:describe-app
/dtfs:describe-screen
/dtfs:questions
/dtfs:generate-spec
/dtfs:map-to-platform
/dtfs:propose
/dtfs:validate
/dtfs:apply
/dtfs:revert
/dtfs:status
Hooks
UserPromptSubmit
→ détecte description app, écran, HTML, Figma

PreToolUse
→ bloque apply_spec si pas de ChangeSet

PostToolUse
→ résumé après commit

Stop
→ session summary + audit
Livrable
L’utilisateur peut piloter tout le cycle depuis Claude Code.
## Phase 16 — Behavior expansion
Objectif

Transformer les raccourcis métier en modèle explicite.

Exemple :

Entity Ticket + behavior ownable

devient :

Attribute ownerId
Policy ticketOwnerOnly
Operation checks
TestScenarios
Behaviors
ownable
soft-deletable
publishable
taggable
searchable
shareable
auditable
versioned
commentable
attachable
localizable
Tool
dtfs__expand_behaviors

Toujours en dry-run d’abord.

Livrable
Les abstractions haut niveau deviennent des DeltaSpecs explicites.
## Phase 17 — Codegen full-stack
Objectif

Générer l’app réelle.

Stack cible
Backend : Hono
ORM : Prisma ou Drizzle
Frontend : Next.js
DB : PostgreSQL
Auth : better-auth ou custom AuthMethod
Assets : local puis S3
Génération backend
Prisma schema
migrations
Hono routes
operation handlers
policy middleware
auth middleware
asset endpoints
integration clients
event emitters
Génération frontend
Next routes
screens
components
forms
field validation
actions
data fetching
translations
theme
asset rendering
GeneratedArtifact

Chaque fichier généré doit être tracé :

path
kind
contentHash
ownership
protected
changeSetId
Livrable
Une app full-stack générée, relançable et traçable.
## Phase 18 — Tests
Objectif

Tester un système hybride déterministe + LLM.

Tests déterministes
Expr validation
Expr eval
Policy eval
Operation validation
DeltaSpec validation
apply_spec
revert_changeset
behavior expansion
codegen output
Golden tests
natural prompt → ProductSpec attendu
screen prompt → ScreenSpec attendu
ProductSpec + ScreenSpec → Requirements attendus
Requirements → PlatformSpec attendu
PlatformSpec → DeltaSpec attendu
Tests LLM

Tu ne testes pas la phrase exacte.
Tu testes le contrat :

JSON valide
Zod valide
pas de fonction Expr inconnue
pas d’Entity inexistante
pas de Policy orpheline
pas d’Operation sans return
pas de Requirement critique non couvert
Tests E2E
décrire app SAV
décrire écran création ticket
générer spec
mapper platform
créer DeltaSpec
commit
générer code
lancer app
soumettre formulaire
revert
vérifier rollback
Livrable
Le LLM peut varier, mais la plateforme reste fiable.
## Phase 19 — Sécurité, audit et gouvernance
Objectif

Empêcher les dérives.

Garde-fous
aucune écriture hors ChangeSet
aucun secret en clair
aucune suppression sans validation
aucune fonction Expr inventée
aucun apply_spec si validate_spec échoue
aucun codegen destructif sans GeneratedArtifact
aucune question critique ouverte avant génération
AuditLog
model AuditLog {
  id        String   @id @default(cuid())
  projectId String?
  actor     String?
  action    String
  target    Json?
  metadata  Json?
  createdAt DateTime @default(now())

  @@schema("dtfs")
}
Livrable
Plateforme gouvernée, traçable, auditée.
## Phase 20 — Plugins Claude Code et Spec Kit extension
Objectif

Packager ton harness.

Spec Kit permet d’installer des intégrations agent et d’ajouter des extensions ou presets pour adapter le workflow aux besoins d’une organisation. La doc du dépôt mentionne notamment les overrides locaux, presets, extensions et commandes ajoutées dans les répertoires agent comme .claude/commands/.

Plugins à prévoir
dtfs-core
dtfs-natural-spec
dtfs-speckit
dtfs-html-import
dtfs-history
dtfs-behaviors
dtfs-codegen
dtfs-security
Extension Spec Kit possible

Créer une extension :

speckit-dtfs

Elle ajoute :

platform-mapping.md
delta-spec.md
control-plane-checklist.md
dtfs-codegen-contract.md
Livrable
Installation propre sur plusieurs projets.
## Phase 21 — Runtime avancé
Objectif

Faire tourner les comportements avancés.

À ajouter plus tard
Temporal workflows
jobs
scheduled triggers
webhooks
event bus
notifications
realtime
search indexing
multi-tenant
billing
deployment automation
monitoring
Concepts futurs
Job
Schedule
WebhookEndpoint
NotificationTemplate
SearchIndex
Tenant
Subscription
BillingPlan
RuntimeMetric
Livrable
La plateforme devient un vrai runtime applicatif.
Ordre final recommandé
## Phase 0  — Bootstrap schéma d’exécution
## Phase 1  — Description naturelle app
## Phase 2  — Description naturelle écrans
## Phase 3  — Questions / hypothèses
## Phase 4  — Spec Kit artifacts
## Phase 5  — Requirements / mapping fonctionnel
## Phase 6  — PlatformSpec proposal
## Phase 7  — DeltaSpec canonique
## Phase 8  — Expr DSL
## Phase 9  — Operation DSL / Policy DSL
## Phase 10 — Modèle Prisma enrichi
## Phase 11 — ChangeSet / Revision
## Phase 12 — API HTTP Control Plane
## Phase 13 — MCP Server minimal
## Phase 14 — Import HTML / Figma
## Phase 15 — Harness Claude Code MVP
## Phase 16 — Behavior expansion
## Phase 17 — Codegen full-stack
## Phase 18 — Tests
## Phase 19 — Sécurité / audit
## Phase 20 — Plugins Claude Code + Spec Kit extension
## Phase 21 — Runtime avancé
Schéma d’exécution réel à prévoir dès la phase 0

Voici le vrai flux que tu dois viser :

USER
  │
  ├─ décrit l’app
  │     ↓
  │   ProductSpec
  │
  ├─ décrit les écrans
  │     ↓
  │   ScreenSpec[]
  │
  ├─ répond aux questions
  │     ↓
  │   Assumptions / OpenQuestions validées
  │
  ├─ génère les specs
  │     ↓
  │   Spec Kit artifacts
  │   constitution.md
  │   spec.md
  │   plan.md
  │   tasks.md
  │
  ├─ mappe vers plateforme
  │     ↓
  │   PlatformSpecProposal
  │
  ├─ demande une proposition
  │     ↓
  │   DeltaSpec
  │
  ├─ valide
  │     ↓
  │   validate_spec OK
  │
  ├─ applique
  │     ↓
  │   ChangeSet committed
  │
  ├─ génère
  │     ↓
  │   GeneratedArtifact[]
  │
  └─ teste / déploie
        ↓
      TestScenario / DeploymentTarget
Règles fondamentales à écrire dès le départ
1. Le langage naturel ne modifie jamais directement le modèle.
2. Spec Kit ne remplace pas le Control Plane.
3. Le Control Plane est la source de vérité exécutable.
4. Toute modification passe par un DeltaSpec.
5. Tout DeltaSpec passe par validate_spec.
6. Toute écriture passe par un ChangeSet.
7. Tout code généré est tracé par GeneratedArtifact.
8. Toute hypothèse critique doit être acceptée ou rejetée.
9. Toute exigence prioritaire doit être couverte par un mapping.
10. Tout comportement doit être exprimé en Operation / Policy / Expr.
Prompt complet à donner à Claude Code pour la prochaine session
Tu vas implémenter la plateforme design-to-fullstack par phases.

Ne commence pas par le codegen.
Ne commence pas par les agents.
Ne commence pas par HTML import.

Phase 0 prioritaire :
Créer le schéma d’exécution complet et les artefacts de documentation :
- docs/ARCHITECTURE.md
- docs/EXECUTION_FLOW.md
- docs/BACKEND_MODEL.md
- docs/DELTA_SPEC.md
- docs/EXPR_DSL.md
- docs/OPERATION_DSL.md
- docs/POLICY_DSL.md
- docs/SPECKIT_INTEGRATION.md
- docs/CODEGEN_CONTRACT.md

Le pipeline cible est :

Natural App Description
→ ProductSpec
→ Natural Screen Description
→ ScreenSpec
→ OpenQuestions / Assumptions
→ Spec Kit artifacts
→ Requirements
→ PlatformSpecProposal
→ DeltaSpec
→ validate_spec
→ ChangeSet
→ Codegen
→ Tests

Spec Kit doit être intégré comme couche de cadrage SDD :
- constitution.md
- spec.md
- plan.md
- tasks.md
- platform-mapping.md

Spec Kit ne remplace pas le Control Plane.
Le Control Plane reste la source de vérité exécutable.

Prévoir les modèles :
- ProductSpec
- ScreenSpec
- Requirement
- RequirementMapping
- SpecArtifact
- Assumption
- OpenQuestion
- Entity
- Attribute
- EntityRelation
- Resource
- Operation
- Policy
- Expr
- Workflow
- Trigger
- Integration
- Asset
- AuthMethod
- Secret
- Environment
- AppRole
- EventDefinition
- Screen
- Component
- Form
- Field
- Action
- DataBinding
- DeltaSpec
- ChangeSet
- Revision
- GeneratedArtifact
- DeploymentTarget
- TestScenario
- AuditLog

Règles impératives :
- aucune écriture hors ChangeSet
- aucun apply_spec sans validate_spec OK
- aucune modification directe DB par agent
- aucun secret en clair
- aucune fonction Expr inventée
- aucune question critique ouverte avant génération
- tout code généré doit être tracé
- tout Requirement prioritaire doit être mappé

Commence uniquement par :
1. documenter l’architecture ;
2. définir les types conceptuels ;
3. définir DeltaSpec ;
4. définir le schéma d’exécution ;
5. préparer les modèles Prisma à ajouter ensuite ;
6. ne pas encore implémenter le codegen.
Mon avis final

La bonne version de ton architecture, c’est celle-ci :

Natural language first
Spec Kit for functional discipline
Control Plane for executable truth
DeltaSpec for controlled mutation
ChangeSet for reversibility
Codegen as consequence

C’est beaucoup plus fort que “je donne un écran à Claude et il code”.

Là, tu construis un vrai système :

intention → spécification → modèle → génération → contrôle

## Phase 22

Bon tu as créé un super scquelle mai on va l'amoliorer
Oui — là on ajoute une couche importante : le Control Plane ne doit plus seulement “décrire” l’app, il doit aussi savoir compiler chaque information backend en API Hono/BetterAuth et chaque information front en app Next 16. Je vais aussi vérifier les versions/documentations actuelles avant de te proposer le cadrage technique.

Réflexion durant 25s

Oui. Là il faut ajouter une couche très importante : la plateforme ne doit pas seulement décrire l’application, elle doit savoir compiler chaque concept du Control Plane vers une app réelle :

Control Plane
→ Backend API Hono
→ Auth Better Auth
→ Frontend Next 16
→ SDK typé partagé
→ Tests
→ Déploiement

Je corrige juste : tu voulais sûrement dire Hono, pas “Honor”. Hono est bien le framework backend léger basé sur les Web Standards ; la version npm visible actuellement est autour de 4.12.x.
Next.js est bien en version stable 16, avec 16.2.6 indiqué dans la documentation officielle au moment de la vérification.
Better Auth est pertinent car il est framework-agnostic, compatible avec des handlers standard Request/Response, et sa documentation prévoit le montage sur /api/auth/*.

Ajout majeur à la roadmap

Il faut ajouter dès la phase 0 un nouveau bloc :

Runtime Target Contract

C’est lui qui dit :

Cette application sera générée pour :
- backend: Hono
- auth: Better Auth
- frontend: Next 16
- database: PostgreSQL
- ORM: Prisma ou Drizzle
- validation: Zod
- package manager: pnpm ou bun

Sans ça, le modèle reste trop abstrait.

Nouveau schéma d’exécution à prévoir dès la phase 0
Natural Description
→ ProductSpec
→ ScreenSpec
→ Spec Kit artifacts
→ PlatformSpec
→ DeltaSpec
→ ChangeSet
→ RuntimeTarget
→ BackendContract
→ FrontendContract
→ SharedContract
→ Codegen Plan
→ Hono API
→ Better Auth config
→ Next 16 app
→ Tests
→ Build

La vraie chaîne devient donc :

Intention
→ Spécification
→ Modèle déclaratif
→ Contrats techniques
→ Code généré
Nouveau concept à ajouter : RuntimeTarget
model RuntimeTarget {
  id             String   @id @default(cuid())
  projectId      String
  name           String   // default, hono-next, etc.
  backend        Json     // { framework: "hono", version: "latest-stable" }
  frontend       Json     // { framework: "next", version: "16.x", router: "app" }
  auth           Json     // { provider: "better-auth" }
  database       Json     // { provider: "postgresql", orm: "prisma" }
  packageManager String?  // pnpm, bun, npm
  runtime        String?  // node, bun, edge
  config         Json?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@unique([projectId, name])
  @@schema("dtfs")
}

Exemple :

{
  "backend": {
    "framework": "hono",
    "versionPolicy": "latest-stable",
    "runtime": "node",
    "apiStyle": "rest"
  },
  "frontend": {
    "framework": "next",
    "version": "16.x",
    "router": "app",
    "rendering": "server-components-first"
  },
  "auth": {
    "provider": "better-auth",
    "basePath": "/api/auth"
  },
  "database": {
    "provider": "postgresql",
    "orm": "prisma"
  }
}
Nouveaux contrats à créer
1. BackendContract

Il décrit ce que le backend doit exposer.

model BackendContract {
  id             String   @id @default(cuid())
  projectId      String
  runtimeTargetId String?
  apiBasePath    String   @default("/api")
  routes         Json
  schemas        Json
  middlewares    Json?
  auth           Json?
  errors         Json?
  generatedFrom  Json?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@schema("dtfs")
}

Il est généré depuis :

Entity
Resource
Operation
Policy
AuthMethod
Asset
Workflow
Trigger
2. FrontendContract

Il décrit ce que le frontend Next doit générer.

model FrontendContract {
  id             String   @id @default(cuid())
  projectId      String
  runtimeTargetId String?
  routes         Json
  pages          Json
  layouts        Json?
  components     Json
  forms          Json
  dataBindings   Json
  actions        Json
  authGuards     Json?
  generatedFrom  Json?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@schema("dtfs")
}

Il est généré depuis :

Screen
Component
Form
Field
Action
DataBinding
Policy
Translation
Theme
Asset
3. SharedContract

C’est le pont entre backend et frontend.

model SharedContract {
  id          String   @id @default(cuid())
  projectId   String
  types       Json
  schemas     Json
  apiClient   Json?
  errors      Json?
  events      Json?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@schema("dtfs")
}

Il contient :

DTOs
Zod schemas
API response types
API error types
Auth session type
Role type
Event payload types
Règle importante

Il ne faut pas faire directement :

Operation → fichier route Hono
Screen → fichier page Next

Il faut faire :

Operation → BackendContract → Hono route
Screen → FrontendContract → Next page
Entity / Operation / Policy → SharedContract → types partagés

Pourquoi ?
Parce que tu peux ensuite changer de cible :

Hono → Fastify
Next → Remix
Prisma → Drizzle
Better Auth → autre auth

sans casser ton Control Plane.

Mapping backend à prévoir
Entity

Une Entity devient :

Prisma model
Zod schema
TypeScript type
Repository
DTO
API resource schema
Frontend type

Exemple :

Entity Customer
→ prisma.customer
→ CustomerSchema
→ CustomerDTO
→ customerRepository
→ /api/customers
Attribute

Un Attribute devient :

DB column
Zod field
Form field type
Validation rule
Input DTO
Output DTO

Exemple :

Attribute email unique required
→ email String @unique
→ z.string().email()
→ input required
→ form email field
Resource

Un Resource devient une famille de routes Hono.

Resource customers
→ GET /api/customers
→ GET /api/customers/:id
→ POST /api/customers
→ PATCH /api/customers/:id
→ DELETE /api/customers/:id

Mais seulement si exposedOps l’autorise.

Operation

Une Operation devient un endpoint Hono explicite.

Operation createSupportTicket
→ POST /api/operations/create-support-ticket

ou, si elle est liée à une ressource :

POST /api/support-tickets

Chaque Operation génère :

input schema
output schema
handler
policy checks
operation steps runner
error mapping
tests
frontend client function
Policy

Une Policy devient :

middleware Hono
guard frontend
server-side permission check
test scenario

Exemple :

Policy customerCanReadOwnTicket
→ requireSession()
→ check $.auth.user.id == $.record.customerId
→ hide unauthorized UI actions
AuthMethod

Un AuthMethod devient une config Better Auth.

SESSION
→ Better Auth email/password or session config
→ /api/auth/*
→ session middleware
→ useSession côté Next

Better Auth doit être monté comme une vraie brique runtime, pas comme un simple concept abstrait. Sa doc indique la création d’un fichier auth.ts, la configuration DB, la génération des tables, puis le montage d’un handler sur /api/auth/*.

Asset

Un Asset devient :

POST /api/assets
GET /api/assets/:id
GET /api/assets/:id/raw
Next image/file rendering
upload component
EventDefinition

Un EventDefinition devient :

typed event payload
event emitter
event handlers
test fixture
Mapping frontend Next 16 à prévoir
Screen

Un Screen devient :

app/<route>/page.tsx

ou :

app/(dashboard)/tickets/page.tsx

selon le layout.

Next 16 reste basé sur l’App Router, avec des évolutions fortes autour de Turbopack, caching explicite et React Compiler.

Component

Un Component devient :

components/generated/<ComponentName>.tsx

Avec une distinction :

server component
client component
form component
layout component
data component
Form

Un Form devient :

React form component
Zod validation schema
submit action
API client call
error display
success state
Field

Un Field devient :

input
select
textarea
checkbox
date picker
asset upload
hidden field
computed field
Action

Une Action devient :

button
link
form submit
server action
API mutation
navigation

Exemple :

Action submitTicket
→ bouton "Envoyer"
→ appelle createSupportTicket()
→ redirige vers /tickets/:id
DataBinding

Un DataBinding devient :

server-side fetch
client query
props mapping
loading state
empty state
error state
Nouveau pipeline de compilation

Il faut ajouter une phase entre ChangeSet et Codegen.

Phase “Compile Contracts”
Control Plane committed
→ compileBackendContract()
→ compileFrontendContract()
→ compileSharedContract()
→ validateContracts()
→ generateCode()

Donc :

DeltaSpec
→ ChangeSet
→ ProjectSpec stable
→ BackendContract
→ FrontendContract
→ SharedContract
→ GeneratedArtifact
Nouveaux MCP tools à ajouter
Runtime / contracts
dtfs__get_runtime_target
dtfs__set_runtime_target
dtfs__compile_backend_contract
dtfs__compile_frontend_contract
dtfs__compile_shared_contract
dtfs__validate_contracts
dtfs__explain_contracts
Codegen
dtfs__generate_backend_api
dtfs__generate_frontend_next
dtfs__generate_shared_sdk
dtfs__generate_auth_runtime
dtfs__generate_database_schema
dtfs__generate_tests
dtfs__plan_codegen
Vérification
dtfs__check_generated_project
dtfs__typecheck_generated_project
dtfs__run_generated_tests
dtfs__diff_generated_artifacts
Nouveaux agents à ajouter

Oui, il faut ajouter des agents spécialisés.

1. dtfs-runtime-architect

Responsabilité :

Définir la cible runtime :
Hono, Better Auth, Next 16, PostgreSQL, Prisma/Drizzle.

Il produit ou valide :

RuntimeTarget
ArchitectureDecision
2. dtfs-backend-contract-compiler

Responsabilité :

Transformer ProjectSpec en BackendContract.

Il mappe :

Entity → DB/schema/repository
Operation → route/handler
Policy → middleware
AuthMethod → Better Auth config
Asset → upload endpoint
Event → emitter
3. dtfs-frontend-contract-compiler

Responsabilité :

Transformer Screen/Component/Form/Field en FrontendContract Next.

Il mappe :

Screen → route Next
Form → component + validation
Action → API call/navigation
DataBinding → fetch/query
Policy → guard UI
4. dtfs-shared-contract-compiler

Responsabilité :

Créer les types et schémas partagés.

Il produit :

Zod schemas
DTOs
API client types
Auth session type
Error types
5. dtfs-hono-api-generator

Responsabilité :

Générer le backend Hono depuis BackendContract.

Il ne lit pas directement l’intention produit.
Il lit uniquement le BackendContract.

6. dtfs-better-auth-generator

Responsabilité :

Générer auth.ts, routes /api/auth/*, middleware session, helpers.

Il lit :

AuthMethod
AppRole
Policy
RuntimeTarget
7. dtfs-next16-generator

Responsabilité :

Générer l’app Next 16 depuis FrontendContract.

Il produit :

app routes
layouts
pages
components
forms
loading.tsx
error.tsx
not-found.tsx
8. dtfs-sdk-generator

Responsabilité :

Générer le client typé frontend vers backend.

Il produit :

lib/api/client.ts
lib/api/types.ts
lib/api/errors.ts

Très important pour éviter que le frontend invente ses appels API.

9. dtfs-codegen-orchestrator

Responsabilité :

Orchestrer tout le codegen.

Ordre :

database
shared
auth
backend
frontend
tests
10. dtfs-generated-code-reviewer

Responsabilité :

Vérifier que le code généré respecte les contrats.

Il cherche :

route manquante
type incohérent
policy non appliquée
form sans validation
secret exposé
fichier manuel écrasé
Nouveaux skills Claude Code
/dtfs:set-runtime
/dtfs:compile-contracts
/dtfs:explain-contracts
/dtfs:generate-backend
/dtfs:generate-auth
/dtfs:generate-frontend
/dtfs:generate-sdk
/dtfs:generate-app
/dtfs:check-generated
/dtfs:run-generated-tests
Skill principal : /dtfs:generate-app

Il doit exécuter :

1. Lire ProjectSpec
2. Lire RuntimeTarget
3. Compiler BackendContract
4. Compiler FrontendContract
5. Compiler SharedContract
6. Valider les contrats
7. Générer DB schema
8. Générer Better Auth
9. Générer Hono API
10. Générer Next 16 frontend
11. Générer SDK typé
12. Générer tests
13. Typecheck
14. Résumer les GeneratedArtifacts
Nouveaux fichiers de documentation à ajouter

Dès la phase 0, ajoute :

docs/RUNTIME_TARGET.md
docs/BACKEND_CONTRACT.md
docs/FRONTEND_CONTRACT.md
docs/SHARED_CONTRACT.md
docs/HONO_GENERATION.md
docs/BETTER_AUTH_GENERATION.md
docs/NEXT16_GENERATION.md
docs/SDK_GENERATION.md
docs/GENERATED_ARTIFACTS.md

Pour toi :

monorepo
apps/api = Hono + Better Auth
apps/web = Next 16
packages/shared = types + schemas + SDK

C’est le plus propre.

Prompt à ajouter à Claude Code

Tu peux ajouter ceci à ton master prompt :

Ajoute une couche RuntimeTarget et Contract Compilation.

Le Control Plane ne génère pas directement du code.
Il compile d’abord trois contrats :

1. BackendContract
   - routes Hono
   - operation handlers
   - policy middleware
   - auth runtime Better Auth
   - asset endpoints
   - database/repository needs

2. FrontendContract
   - Next 16 routes
   - pages
   - layouts
   - components
   - forms
   - actions
   - data bindings
   - auth guards

3. SharedContract
   - DTOs
   - Zod schemas
   - API client types
   - error types
   - auth session type
   - event payloads

Runtime cible :
- Backend : Hono latest stable
- Auth : Better Auth latest stable
- Frontend : Next 16 latest stable
- DB : PostgreSQL
- ORM : Prisma by default, Drizzle optional later
- Package manager : pnpm by default

Toute information backend doit pouvoir se transformer en :
- Hono route
- handler
- middleware
- repository
- schema
- test

Toute information frontend doit pouvoir se transformer en :
- Next route
- page
- component
- form
- action
- API client call
- loading/error/empty state

Ajoute les modèles :
- RuntimeTarget
- BackendContract
- FrontendContract
- SharedContract

Ajoute les agents :
- dtfs-runtime-architect
- dtfs-backend-contract-compiler
- dtfs-frontend-contract-compiler
- dtfs-shared-contract-compiler
- dtfs-hono-api-generator
- dtfs-better-auth-generator
- dtfs-next16-generator
- dtfs-sdk-generator
- dtfs-codegen-orchestrator
- dtfs-generated-code-reviewer

Ajoute les MCP tools :
- dtfs__get_runtime_target
- dtfs__set_runtime_target
- dtfs__compile_backend_contract
- dtfs__compile_frontend_contract
- dtfs__compile_shared_contract
- dtfs__validate_contracts
- dtfs__explain_contracts
- dtfs__generate_backend_api
- dtfs__generate_frontend_next
- dtfs__generate_shared_sdk
- dtfs__generate_auth_runtime
- dtfs__generate_database_schema
- dtfs__generate_tests
- dtfs__check_generated_project
- dtfs__typecheck_generated_project
- dtfs__run_generated_tests

Ajoute les skills :
- /dtfs:set-runtime
- /dtfs:compile-contracts
- /dtfs:explain-contracts
- /dtfs:generate-backend
- /dtfs:generate-auth
- /dtfs:generate-frontend
- /dtfs:generate-sdk
- /dtfs:generate-app
- /dtfs:check-generated
- /dtfs:run-generated-tests

Règle clé :
Entity, Operation, Policy, Screen, Form, Action et DataBinding ne génèrent jamais directement du code.
Ils génèrent d’abord des contrats.
Le codegen lit uniquement les contrats validés.
Mon avis

Oui, il faut absolument prévoir cette couche.

La bonne architecture devient :

Control Plane
→ Contracts
→ Generators
→ Generated App
Prompt à coller à Claude
On ne recommence pas le projet.

Tu dois faire un addendum / retrofit sur l’architecture déjà générée.

Contexte :
Le Control Plane existe déjà avec les concepts :
Project, Entity, Attribute, EntityRelation, Resource, Operation, Workflow, Policy, Integration, Trigger, Behavior, Asset, AuthMethod, Screen, Component, Form, Field, Translation, Theme, ChangeSet, Revision, Expr DSL, MCP tools, agents Claude Code, skills et hooks.

Nouvel objectif :
Ajouter une couche RuntimeTarget + Contract Compilation pour que chaque information du Control Plane puisse être transformée proprement en :

1. Backend API Hono
2. Auth runtime Better Auth
3. Frontend Next 16
4. Shared SDK typé
5. Tests générés
6. GeneratedArtifacts traçables

Règle importante :
Ne génère pas directement du code depuis Entity, Operation, Policy ou Screen.
Il faut d’abord compiler des contrats intermédiaires :

Control Plane
→ BackendContract
→ FrontendContract
→ SharedContract
→ Codegen Hono / BetterAuth / Next 16

Ne casse pas les migrations existantes.
Ne supprime pas les concepts déjà créés.
Fais des ajouts additifs.
Si une migration a déjà été appliquée, crée une migration suivante type control_plane_v1_3_runtime_contracts.

Ajoute les concepts suivants au modèle plateforme :

1. RuntimeTarget
Décrit la cible runtime :
- backend framework: Hono
- auth provider: Better Auth
- frontend framework: Next 16
- database: PostgreSQL
- ORM: Prisma par défaut
- package manager: pnpm par défaut
- runtime: Node ou Bun selon configuration

2. BackendContract
Décrit ce que le backend doit exposer :
- routes
- handlers
- schemas
- repositories
- policy middleware
- auth requirements
- asset endpoints
- event emitters
- generatedFrom

3. FrontendContract
Décrit ce que le frontend Next doit générer :
- routes
- layouts
- pages
- components
- forms
- actions
- data bindings
- auth guards
- loading states
- error states
- empty states
- generatedFrom

4. SharedContract
Décrit les éléments partagés :
- DTOs
- Zod schemas
- API response types
- API error types
- auth session type
- role type
- event payload types
- SDK client description

5. GeneratedArtifact
Si déjà présent, l’étendre.
Sinon, l’ajouter.
Il doit tracer :
- path
- kind
- contentHash
- ownership: generated | manual | mixed
- protected
- changeSetId
- generatedFrom
- runtimeTargetId

Ajoute aussi ces documents :

docs/RUNTIME_TARGET.md
docs/BACKEND_CONTRACT.md
docs/FRONTEND_CONTRACT.md
docs/SHARED_CONTRACT.md
docs/HONO_GENERATION.md
docs/BETTER_AUTH_GENERATION.md
docs/NEXT16_GENERATION.md
docs/SDK_GENERATION.md
docs/GENERATED_ARTIFACTS.md

Mets à jour :

docs/ARCHITECTURE.md
docs/EXECUTION_FLOW.md
docs/BACKEND_MODEL.md
docs/CODEGEN_CONTRACT.md
docs/HARNESS.md
docs/HARNESS_DEV.md

Nouveau flux d’exécution cible :

Natural App Description
→ ProductSpec
→ ScreenSpec
→ Spec Kit artifacts
→ PlatformSpec
→ DeltaSpec
→ ChangeSet
→ ProjectSpec committed
→ RuntimeTarget
→ BackendContract
→ FrontendContract
→ SharedContract
→ validateContracts
→ generateDatabaseSchema
→ generateAuthRuntime
→ generateBackendApi
→ generateFrontendNext
→ generateSharedSdk
→ generateTests
→ typecheck
→ GeneratedArtifacts

Mapping obligatoire :

Entity
→ Prisma model
→ Zod schema
→ DTO
→ Repository
→ API type
→ Frontend type

Attribute
→ DB column
→ Zod field
→ form field
→ validation rule

Resource
→ REST routes Hono
→ frontend SDK methods

Operation
→ Hono endpoint
→ operation handler
→ SDK function
→ frontend action or mutation

Policy
→ Hono middleware
→ server-side guard
→ frontend auth guard
→ generated test

AuthMethod
→ Better Auth configuration
→ /api/auth/*
→ session helpers
→ auth middleware

Asset
→ upload endpoint
→ metadata endpoint
→ raw file endpoint
→ upload component
→ asset renderer

Screen
→ Next 16 route
→ page.tsx
→ layout association

Component
→ generated React component
→ server/client classification

Form
→ React form
→ Zod validation
→ submit action
→ error handling

Field
→ input/select/textarea/upload/etc.
→ validation
→ default values

Action
→ button/link/form submit
→ API call or navigation

DataBinding
→ server fetch or client query
→ props mapping
→ loading/error/empty state

EventDefinition
→ typed event payload
→ event emitter
→ handler contract

TestScenario
→ unit/API/UI/e2e test

Ajoute les MCP tools suivants :

Runtime / contracts:
- dtfs__get_runtime_target
- dtfs__set_runtime_target
- dtfs__compile_backend_contract
- dtfs__compile_frontend_contract
- dtfs__compile_shared_contract
- dtfs__validate_contracts
- dtfs__explain_contracts

Codegen:
- dtfs__plan_codegen
- dtfs__generate_database_schema
- dtfs__generate_auth_runtime
- dtfs__generate_backend_api
- dtfs__generate_frontend_next
- dtfs__generate_shared_sdk
- dtfs__generate_tests

Verification:
- dtfs__check_generated_project
- dtfs__typecheck_generated_project
- dtfs__run_generated_tests
- dtfs__diff_generated_artifacts

Ajoute les agents Claude Code suivants :

- dtfs-runtime-architect
- dtfs-backend-contract-compiler
- dtfs-frontend-contract-compiler
- dtfs-shared-contract-compiler
- dtfs-hono-api-generator
- dtfs-better-auth-generator
- dtfs-next16-generator
- dtfs-sdk-generator
- dtfs-codegen-orchestrator
- dtfs-generated-code-reviewer

Ajoute les skills / slash commands suivants :

- /dtfs:set-runtime
- /dtfs:compile-contracts
- /dtfs:explain-contracts
- /dtfs:generate-backend
- /dtfs:generate-auth
- /dtfs:generate-frontend
- /dtfs:generate-sdk
- /dtfs:generate-app
- /dtfs:check-generated
- /dtfs:run-generated-tests

Le skill principal /dtfs:generate-app doit suivre cet ordre :

1. Lire ProjectSpec
2. Lire RuntimeTarget
3. Compiler BackendContract
4. Compiler FrontendContract
5. Compiler SharedContract
6. Valider les contrats
7. Générer database schema
8. Générer Better Auth runtime
9. Générer Hono API
10. Générer Next 16 frontend
11. Générer SDK typé
12. Générer tests
13. Lancer typecheck
14. Résumer les GeneratedArtifacts

Architecture générée cible :

generated-app/
  apps/
    api/
      src/
        index.ts
        auth.ts
        routes/
        operations/
        policies/
        repositories/
        middleware/
        assets/
        events/

    web/
      app/
      components/
        generated/
      lib/
        api/
        auth/
        schemas/

  packages/
    shared/
      src/
        schemas/
        types/
        errors.ts
        api-contract.ts

  prisma/
    schema.prisma
    migrations/

  tests/
    api/
    e2e/
    contract/

Règles impératives :

- Ne pas casser ce qui existe.
- Ne pas supprimer les agents existants.
- Ne pas remplacer les MCP tools existants.
- Ajouter les nouveaux concepts de manière additive.
- Si le codegen actuel génère déjà du code directement depuis le Control Plane, ne pas le supprimer brutalement : introduire une couche de compatibilité temporaire.
- À terme, le codegen doit lire uniquement BackendContract, FrontendContract et SharedContract.
- Toute génération doit produire ou mettre à jour des GeneratedArtifacts.
- Aucun fichier manuel ne doit être écrasé sans protection.
- Les fichiers generated doivent être identifiables.
- Les contrats doivent être validés avant génération.
- Better Auth doit être isolé dans une couche auth runtime.
- Hono doit être le backend API principal.
- Next 16 doit être le frontend principal.
- Le SDK typé doit être la seule manière standard pour le frontend d’appeler l’API.

Commence par faire un audit de l’existant :
1. Liste les fichiers déjà créés.
2. Identifie où ajouter RuntimeTarget, BackendContract, FrontendContract, SharedContract.
3. Identifie les documents à mettre à jour.
4. Identifie les MCP tools existants à étendre.
5. Identifie les agents existants à compléter.
6. Propose un plan de patch en 5 étapes.
7. Ensuite seulement, applique les changements.
Ce qu’il doit faire maintenant

Demande-lui d’abord un audit, pas directement du code.

L’ordre idéal :

Phase 23. Audit de ce qui a déjà été généré
Phase 24. Ajout docs runtime/contracts
Phase 25. Ajout modèles Prisma RuntimeTarget / Contracts / GeneratedArtifact
Phase 26. Ajout fonctions compile contracts
Phase 27. Ajout MCP tools
Phase 28. Ajout agents/skills
Phase 29. Adaptation codegen
Phase 30. Tests

## Phase 23 — Audit de ce qui existe déjà

Objectif : comprendre ce que Claude a déjà créé.

Il doit lister :

- les modèles Prisma existants
- les migrations déjà créées
- les docs déjà générées
- les MCP tools déjà présents
- les agents Claude Code déjà créés
- les skills / slash commands existants
- les fichiers liés au codegen s’il y en a déjà

But : éviter de refaire, écraser ou casser.

Prompt court :

Commence par auditer l’existant. Ne modifie rien tant que tu n’as pas identifié les fichiers, modèles, tools, agents et docs déjà présents.
## Phase 24 — Ajout des docs Runtime / Contracts

Objectif : documenter la nouvelle couche avant de coder.

À ajouter :

docs/RUNTIME_TARGET.md
docs/BACKEND_CONTRACT.md
docs/FRONTEND_CONTRACT.md
docs/SHARED_CONTRACT.md
docs/HONO_GENERATION.md
docs/BETTER_AUTH_GENERATION.md
docs/NEXT16_GENERATION.md
docs/SDK_GENERATION.md
docs/GENERATED_ARTIFACTS.md

À mettre à jour :

docs/ARCHITECTURE.md
docs/EXECUTION_FLOW.md
docs/BACKEND_MODEL.md
docs/CODEGEN_CONTRACT.md
docs/HARNESS.md
docs/HARNESS_DEV.md

But : inscrire officiellement le nouveau flux :

Control Plane
→ BackendContract
→ FrontendContract
→ SharedContract
→ Codegen
Step 3 — Ajout des modèles Prisma

Objectif : ajouter les nouveaux concepts de manière additive.

À créer :

RuntimeTarget
BackendContract
FrontendContract
SharedContract

À ajouter ou enrichir :

GeneratedArtifact

La migration doit être une nouvelle migration, par exemple :

control_plane_v1_3_runtime_contracts

Règle importante :

ne pas modifier brutalement les migrations déjà appliquées
PHase 25 — Ajout des fonctions de compilation de contrats

Objectif : transformer le modèle déclaratif en contrats techniques.

À créer côté backend :

compileBackendContract(projectId)
compileFrontendContract(projectId)
compileSharedContract(projectId)
validateContracts(projectId)
explainContracts(projectId)

Le mapping doit être clair :

Entity → schema DB / DTO / repository
Operation → route Hono / handler / SDK method
Policy → middleware / guard
Screen → route Next / page
Form → composant React + validation
Action → appel API ou navigation
DataBinding → fetch / query / props
AuthMethod → Better Auth config

But : ne plus générer du code directement depuis le Control Plane.

## Phase 26 — Ajout des MCP tools

Objectif : permettre à Claude Code de piloter cette nouvelle couche.

À ajouter :

dtfs__get_runtime_target
dtfs__set_runtime_target
dtfs__compile_backend_contract
dtfs__compile_frontend_contract
dtfs__compile_shared_contract
dtfs__validate_contracts
dtfs__explain_contracts

Puis pour le codegen :

dtfs__plan_codegen
dtfs__generate_database_schema
dtfs__generate_auth_runtime
dtfs__generate_backend_api
dtfs__generate_frontend_next
dtfs__generate_shared_sdk
dtfs__generate_tests

Et pour vérifier :

dtfs__check_generated_project
dtfs__typecheck_generated_project
dtfs__run_generated_tests
dtfs__diff_generated_artifacts

Règle : les MCP tools ne doivent pas bypasser l’API backend.

## Phase 27 — Ajout des agents et skills Claude Code

Objectif : spécialiser Claude Code pour la génération runtime.

Agents à ajouter :

dtfs-runtime-architect
dtfs-backend-contract-compiler
dtfs-frontend-contract-compiler
dtfs-shared-contract-compiler
dtfs-hono-api-generator
dtfs-better-auth-generator
dtfs-next16-generator
dtfs-sdk-generator
dtfs-codegen-orchestrator
dtfs-generated-code-reviewer

Skills / slash commands :

/dtfs:set-runtime
/dtfs:compile-contracts
/dtfs:explain-contracts
/dtfs:generate-backend
/dtfs:generate-auth
/dtfs:generate-frontend
/dtfs:generate-sdk
/dtfs:generate-app
/dtfs:check-generated
/dtfs:run-generated-tests

Le plus important est :

/dtfs:generate-app

qui orchestre tout.

Phase  28 — Adaptation du codegen

Objectif : faire évoluer le codegen existant.

Ancienne logique à éviter :

Entity / Operation / Screen
→ code direct

Nouvelle logique :

Entity / Operation / Screen
→ BackendContract / FrontendContract / SharedContract
→ code généré

Ordre de génération recommandé :

1. database schema
2. shared schemas/types
3. Better Auth runtime
4. Hono backend API
5. Next 16 frontend
6. SDK typé
7. tests

Architecture cible :

generated-app/
  apps/
    api/
      src/
        index.ts
        auth.ts
        routes/
        operations/
        policies/
        repositories/
        middleware/
        assets/
        events/

    web/
      app/
      components/
        generated/
      lib/
        api/
        auth/
        schemas/

  packages/
    shared/
      src/
        schemas/
        types/
        errors.ts
        api-contract.ts

  prisma/
    schema.prisma
    migrations/

  tests/
    api/
    e2e/
    contract/
## Phase 29 — Tests et validation finale

Objectif : vérifier que l’addendum n’a rien cassé.

À lancer :

typecheck backend
tests backend
validation Prisma
validation MCP tools
test compile contracts
test generate app
test generated project typecheck

Tests clés :

ProjectSpec → BackendContract OK
ProjectSpec → FrontendContract OK
ProjectSpec → SharedContract OK
Contracts → Hono API OK
Contracts → Next frontend OK
Contracts → SDK typé OK
GeneratedArtifacts bien créés
Aucun fichier manuel écrasé

Critère de succès :

