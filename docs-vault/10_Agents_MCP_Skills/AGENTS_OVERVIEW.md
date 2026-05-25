# Agents Overview

DTFS dispose de 19 agents Claude Code spécialisés organisés selon le pipeline de conception-génération. Chaque agent a un rôle unique, un ensemble d'outils MCP restreint et des règles d'honnêteté strictes.

Le pattern d'orchestration repose sur deux agents transversaux (`step-executor`, `step-verifier`) qui encadrent l'exécution de n'importe quelle étape du pipeline.

Liens : [[AGENT_RESPONSIBILITIES]] · [[SKILLS_AND_COMMANDS]] · [[../09_ADR/ADR-0008-use-contract-compilation-before-codegen]].

## Source of truth

`.claude/agents/dtfs-*.md` — définitions des 19 agents DTFS. `.claude/agents/step-executor.md` + `step-verifier.md`.

## AI usage

Les agents sont invoqués via les slash commands `/dtfs:*` ou explicitement avec `@agent-name`. Les agents ne se chaînent pas automatiquement — chaque transition est validée par l'utilisateur ou un agent orchestrateur.

## Status

19/19 agents actifs. Voir [[AGENT_RESPONSIBILITIES]] pour les chevauchements identifiés.

---

## Les 19 agents DTFS

### Pipeline naturel (Phases 1–7)

| Agent | Phase | Rôle résumé |
|-------|-------|-------------|
| `dtfs-product-analyst` | 1 | Texte libre → `ProductSpec` structuré |
| `dtfs-screen-spec-writer` | 2 | Description UI → `ScreenSpec` |
| `dtfs-question-manager` | 3 | Résoudre `OpenQuestion` + `Assumption` |
| `dtfs-sdd-writer` | 4 | Générer les artefacts Spec Kit (SDD) |
| `dtfs-sdd-reviewer` | 4 | Cross-check SDD vs ProductSpec + ScreenSpec |
| `dtfs-requirement-extractor` | 5 | Extraire les `Requirement` rows depuis SDD |
| `dtfs-platform-mapper` | 5–6 | Mapper Requirements → Control Plane + `PlatformSpecProposal` DRAFT |
| `dtfs-spec-writer` | 7 | Proposal ACCEPTED → `DeltaSpec` validé + expliqué |
| `dtfs-spec-validator` | any | Validation read-only (DeltaSpec, op, policy, expr, proposal) |
| `dtfs-diff-explainer` | any | Expliquer les ChangeSets et diffs en langage naturel |

### Runtime & Codegen (Phase 26+)

| Agent | Phase | Rôle résumé |
|-------|-------|-------------|
| `dtfs-runtime-architect` | 26 | Choisir et persister le `RuntimeTarget` |
| `dtfs-backend-contract-compiler` | 26 | Compiler le `BackendContract` |
| `dtfs-frontend-contract-compiler` | 26 | Compiler le `FrontendContract` |
| `dtfs-shared-contract-compiler` | 26 | Compiler le `SharedContract` |
| `dtfs-hono-api-generator` | 26+ | Générer les routes Hono 4 |
| `dtfs-better-auth-generator` | 26+ | Générer `auth.ts` + middleware Better Auth |
| `dtfs-next16-generator` | 26+ | Générer les pages Next.js 16 |
| `dtfs-sdk-generator` | 26+ | Générer le package SDK partagé |
| `dtfs-codegen-orchestrator` | 26 | Orchestrer le pipeline complet contracts → generate_app |
| `dtfs-generated-code-reviewer` | 26 | Auditer le code généré (read-only) |

### Orchestrateurs transversaux

| Agent | Rôle |
|-------|------|
| `step-executor` | Exécuter une étape isolée du pipeline avec critères de done |
| `step-verifier` | Vérifier les critères de done d'une étape exécutée |

---

## Pattern orchestrateur

`step-executor` reçoit : numéro de step, objectif unique, inputs, critères de done. Il exécute uniquement cette step et retourne un rapport JSON `{step, status, outputs, files_changed, notes}`.

`step-verifier` reçoit le rapport du `step-executor` et valide chaque critère de done. Il remonte les obstacles sans inventer.

Ce pattern garantit que chaque step est vérifiable indépendamment et que les agents ne font pas de travail spéculatif hors scope.

---

## Flux d'ensemble

```
describe-app → describe-screen → questions → generate-spec
  → (sdd-reviewer) → (requirement-extractor)
  → map-to-platform → propose
  → (spec-validator) → (spec-writer)
  → apply → status → (revert si besoin)
  → set-runtime → compile-contracts
  → generate-app (dry-run → confirm → write)
  → check-generated → run-generated-tests
```
