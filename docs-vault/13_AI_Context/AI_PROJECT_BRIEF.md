# AI Project Brief — DTFS

Brief destiné à tout agent IA arrivant sur le dépôt `design-to-fullstack`. Lire en premier, avant toute action. DTFS est une plateforme qui transforme un design ou une description en langage naturel en une application full-stack complète, via un pipeline de 10 étapes gouvernées. Deux plans cohabitent : le **Control Plane** (base de données de spécifications et d'orchestration, jamais exposée à l'utilisateur final) et l'**app cliente générée** (code produit vers un répertoire de sortie). Ces deux plans ne partagent ni schéma de base de données, ni sessions d'authentification.

Liens : [[../00_Home/AI_INDEX]] · [[../02_Architecture/ARCHITECTURE_OVERVIEW]] · [[../03_Control_Plane/DELTA_SPEC]] · [[../03_Control_Plane/CHANGESET_FLOW]] · [[../04_Runtime_Contracts/CODEGEN_CONTRACT]]

## Les deux plans

| Plan | Rôle | Base de données | Auth |
|---|---|---|---|
| **Control Plane** | Stocke ProductSpec, ScreenSpec, Entity, Operation, Policy, DeltaSpec, ChangeSet, GeneratedArtifact, AuditLog… | PostgreSQL `backend/prisma/schema.prisma` — 43 modèles | Better Auth **Control Plane** (sessions des auteurs du design) |
| **App cliente** | Code généré dans `outDir` par `generate_app` | Schéma propre à l'app, émis par `emit-prisma.ts` | Better Auth **isolé** dans `apps/api/src/auth.ts` généré — ne partage rien avec le Control Plane |

## Pipeline en 10 étapes

```
1. ProductSpec        (dtfs-product-analyst)
2. ScreenSpec         (dtfs-screen-spec-writer)
3. OpenQuestions      (dtfs-question-manager) → clarification-gate
4. SDD artifacts      (dtfs-sdd-writer / dtfs-sdd-reviewer)
5. Requirements       (dtfs-requirement-extractor) → coverage-gate
6. PlatformSpecProposal (dtfs-platform-mapper) → ACCEPTED
7. DeltaSpec          (dtfs-spec-writer) → validateDeltaSpec ✓
8. ChangeSet apply    (/dtfs:apply) → begin → apply → commit
9. Contracts compile  (compile_shared → backend → frontend → validate)
10. generate_app      (dryRun → confirm → write → check → test)
```

## Où est la vérité

- **Spécification** : le Control Plane DB (tables Prisma) — la source de vérité absolue.
- **DeltaSpec canonique** : `backend/src/lib/dsl/delta-spec.ts` (21 buckets).
- **Contrats compilés** : `BackendContract`, `FrontendContract`, `SharedContract` — intermédiaires entre spec et codegen.
- **Code généré** : `outDir/` (répertoire externe) — jamais committé dans ce dépôt.
- **MCP tools** : 102 outils enregistrés dans `backend/src/mcp.ts`, référence dans `docs/MCP_TOOLS.md`.

## Source of truth

`backend/prisma/schema.prisma` (modèles) · `backend/src/lib/dsl/delta-spec.ts` (DSL) · `docs/EXECUTION_FLOW.md` (pipeline) · `docs/HARNESS.md` (agents + slash commands)

## AI usage

Utiliser ce fichier comme point d'entrée systématique. Ne pas agir avant d'avoir lu [[AI_RULES]] et [[AI_DO_NOT_BREAK]].

## Status

Stable — reflète l'audit du 2026-05-25 (score 78 %).
