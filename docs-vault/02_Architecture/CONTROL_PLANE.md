# CONTROL_PLANE

Le Control Plane est l'usine centrale de DTFS. Il stocke toutes les définitions (specs, modèles déclaratifs, contrats, changements, artefacts) dans une base PostgreSQL dédiée. C'est la seule source de vérité : l'app générée est une conséquence, pas une source.

Liens : [[ARCHITECTURE_OVERVIEW]] · [[CLIENT_APP_RUNTIME]] · [[SEPARATION_OF_CONCERNS]] · [[EXECUTION_FLOW]] · [[DATA_OWNERSHIP]]

---

## Périmètre

Le Control Plane contient :

### 1. Specs naturelles

| Modèle | Rôle |
|---|---|
| `ProductSpec` | Purpose, personas, goals, glossary de l'app |
| `ScreenSpec` | Champs, actions, dataNeeds, états de chaque écran |

### 2. Clarification

| Modèle | Rôle |
|---|---|
| `OpenQuestion` | Ambiguïtés à résoudre avant génération |
| `Assumption` | Décisions prises en l'absence de réponse |

### 3. Spec Kit

| Modèle | Kind | Rôle |
|---|---|---|
| `SpecArtifact` | CONSTITUTION | Principes de l'app |
| `SpecArtifact` | SPEC | Spec fonctionnelle (Markdown) |
| `SpecArtifact` | PLAN | Plan technique |
| `SpecArtifact` | TASKS | Liste ordonnée de tâches |

### 4. Platform Mapping

| Modèle | Rôle |
|---|---|
| `Requirement` | Exigence fonctionnelle ou non-fonctionnelle |
| `RequirementMapping` | Lien Requirement → concept Control Plane |
| `PlatformSpecProposal` | Proposition intermédiaire avant DeltaSpec |

### 5. Modèle déclaratif (le spec de l'app)

| Domaine | Modèles |
|---|---|
| Données | `Entity` · `Attribute` · `EntityRelation` · `EntityRecord` |
| API | `Resource` · `Operation` |
| Auth & Sécurité | `Policy` · `AuthMethod` · `Secret` · `AppRole` |
| Comportement | `Behavior` · `Workflow` |
| Intégrations | `Integration` · `Trigger` · `EventDefinition` |
| UI | `Screen` · `Component` · `Form` · `Field` · `FieldOption` · `Action` · `DataBinding` |
| Fichiers | `Asset` |
| Config | `Environment` |

### 6. Versioning

| Modèle | Rôle |
|---|---|
| `ChangeSet` | Groupe de mutations avec message, statut (DRAFT/APPLIED/REVERTED) |
| `Revision` | Une mutation atomique liée à un ChangeSet |

### 7. Contrats (intermédiaires de codegen)

| Modèle | Rôle |
|---|---|
| `RuntimeTarget` | Déclare la stack cible (hono-next, versions, packageManager) |
| `BackendContract` | Surface compilée du backend (routes, schemas, middlewares, auth) |
| `FrontendContract` | Surface compilée du frontend (pages, forms, dataBindings, actions) |
| `SharedContract` | Types partagés, Zod schemas, SDK client |

### 8. Artefacts générés

| Modèle | Rôle |
|---|---|
| `GeneratedArtifact` | Fichier généré avec contentHash, flag protected, lien vers contrat |
| `DeploymentTarget` | Cible de déploiement (placeholder) |

### 9. Tests & Audit

| Modèle | Rôle |
|---|---|
| `TestScenario` | Scénario déclaratif par Operation (inputs, expected, mocks) |
| `AuditLog` | Log d'events (apply_delta, commit, revert, generate) |

---

## Base de données

Le Control Plane utilise **une base PostgreSQL dédiée**, schéma `dtfs`. Elle ne contient aucune table métier des apps générées.

- Schéma Prisma : `backend/prisma/schema.prisma`
- Client généré : `backend/generated/prisma/` (gitignored)
- Connexion : `@prisma/adapter-pg`, injectée au runtime via `.env`
- 43 modèles cibles — tous présents (audit 2026-05-25)
- 14 migrations appliquées (incl. `phase_10_enriched_models` + `control_plane_v1_3_runtime_contracts`)

---

## Seul chemin d'écriture

Toute mutation du Control Plane passe par :

```
DeltaSpec (body HTTP) → validate_spec → applyDeltaSpec → ChangeSet + Revisions
```

Le middleware `changeset-middleware.ts` enforce cette règle sur tout `POST/PUT/PATCH/DELETE` sous `/api/projects/:id/*`.

---

## Ce que le Control Plane ne contient PAS

- Aucune table `users`/`sessions`/`accounts` de Better Auth des apps clientes.
- Aucune table métier générée (TodoList, Comment, etc.).
- Aucun fichier de l'app générée (ceux-ci sont dans `generated-app/` sur le filesystem et référencés par `GeneratedArtifact`).

Voir [[SEPARATION_OF_CONCERNS]] et [[DATA_OWNERSHIP]].

---

## Source of truth

`backend/prisma/schema.prisma` · `docs/BACKEND_MODEL.md` · `docs/AUDIT_REPORT.md` (tableau de conformité)

## AI usage

Un agent qui modifie le spec d'une app ne doit jamais écrire directement dans la DB Prisma du Control Plane. Il utilise les MCP tools (`dtfs__apply_delta_spec`, `dtfs__begin_changeset`, etc.) qui passent par le middleware de validation.

## Status

implemented
