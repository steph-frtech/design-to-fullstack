# ARCHITECTURE_OVERVIEW

DTFS est organisé en deux plans distincts reliés par un pipeline de 10 couches. Le Control Plane est l'usine qui transforme des specs en code. Le Client App Runtime est le produit généré — une app full-stack autonome.

Liens : [[CONTROL_PLANE]] · [[CLIENT_APP_RUNTIME]] · [[EXECUTION_FLOW]] · [[SEPARATION_OF_CONCERNS]]

---

## Les deux plans

```
┌─────────────────────────────────────────────────────────────┐
│   CONTROL PLANE  (schéma dtfs — base DTFS)                  │
│                                                             │
│   Stocke les DÉFINITIONS :                                  │
│     Entity, Resource, Operation, Policy, Screen,            │
│     Form, Field, Action, DataBinding, AuthMethod,           │
│     Asset, ChangeSet, Revision, GeneratedArtifact,          │
│     RuntimeTarget, BackendContract, FrontendContract,       │
│     SharedContract, AuditLog, TestScenario…                 │
│                                                             │
│   Manipulé par : utilisateurs, LLMs, agents MCP.            │
│   Seul chemin d'écriture : DeltaSpec → ChangeSet.           │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               │  compile() + codegen  ← Layer 9
                               ▼
┌─────────────────────────────────────────────────────────────┐
│   CLIENT APP RUNTIME  (schéma gen_<slug> — base cliente)    │
│                                                             │
│   Artefact généré, déployable indépendamment :              │
│     apps/api        ← Hono 4 + Better Auth                  │
│     apps/web        ← Next 16 App Router                    │
│     packages/shared ← types Zod + SDK typé                  │
│     prisma/         ← schéma généré + migrations            │
│     docker-compose.yml                                      │
│                                                             │
│   Sa propre base PostgreSQL :                               │
│     users, sessions, accounts (Better Auth)                 │
│     tables métier générées depuis les Entity                │
│                                                             │
│   Aucune table du Control Plane ici.                        │
└─────────────────────────────────────────────────────────────┘
```

## Ce que contient chaque plan

### Control Plane

| Couche | Contenu |
|---|---|
| Specs naturelles | `ProductSpec` · `ScreenSpec` |
| Clarification | `OpenQuestion` · `Assumption` |
| Spec Kit | `SpecArtifact` (CONSTITUTION / SPEC / PLAN / TASKS) |
| Platform Mapping | `Requirement` · `RequirementMapping` |
| Modèle déclaratif | `Entity` · `Attribute` · `EntityRelation` · `Resource` · `Operation` · `Policy` · `AuthMethod` · `Screen` · `Component` · `Form` · `Field` · `Action` · `DataBinding` · `Behavior` · `Workflow` · `Asset` · `Integration` · `Trigger` · `EventDefinition` |
| Versionning | `ChangeSet` · `Revision` |
| Contrats | `RuntimeTarget` · `BackendContract` · `FrontendContract` · `SharedContract` |
| Artefacts | `GeneratedArtifact` · `DeploymentTarget` |
| Tests & audit | `TestScenario` · `AuditLog` |

### Client App Runtime

| Composant | Généré depuis |
|---|---|
| `prisma/schema.prisma` | `BackendContract.schemas` (Entity → table) |
| `apps/api/src/routes/*.ts` | `BackendContract.routes` via `emit-hono.ts` |
| `apps/api/src/auth.ts` | `BackendContract.auth` via `emit-auth.ts` |
| `apps/web/app/**/*.tsx` | `FrontendContract.pages` via `emit-next.ts` |
| `packages/shared/src/**` | `SharedContract` via `emit-sdk.ts` |
| `docker-compose.yml` | Configuration runtime |

## Le pipeline en une ligne

```
Description naturelle → specs déclaratives → DeltaSpec → ChangeSet → Contrats → Code → App déployable
```

## Règle cardinale

Le LLM ne va **jamais** directement de prompt → code. Il passe toujours par le pipeline complet. Les contrats sont la seule source autorisée pour les emitters — jamais le Control Plane directement.

## Source of truth

`docs/ARCHITECTURE.md` · `docs/RUNTIME_CONTRACTS_OVERVIEW.md` · `backend/prisma/schema.prisma`

## AI usage

Ce fichier est le point d'entrée pour tout agent qui doit comprendre la structure globale. Lire ensuite [[CONTROL_PLANE]] pour les modèles de données et [[EXECUTION_FLOW]] pour le flux complet.

## Status

documented
