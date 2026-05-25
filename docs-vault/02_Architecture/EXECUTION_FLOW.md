# EXECUTION_FLOW

Le flux d'exécution bout-en-bout de DTFS — de la description naturelle à l'app cliente déployable. Chaque maillon est conditionné par le précédent. Deux gates bloquants sont définis ; leur enforcement effectif dans le code est noté.

Liens : [[ARCHITECTURE_OVERVIEW]] · [[CONTROL_PLANE]] · [[CLIENT_APP_RUNTIME]] · [[SECURITY_MODEL]]

---

## Flux complet

```
Natural description + HTML/Figma               (Layer 0 — transient)
  │
  ▼  [agent: dtfs-product-analyst]
ProductSpec                                    (Layer 1)
  │   purpose, personas, goals, glossary
  │
  ▼  [agent: dtfs-screen-spec-writer]
ScreenSpec (N écrans)                          (Layer 2)
  │   fields, actions, dataNeeds, states
  │
  ▼  [agent: dtfs-question-manager]
OpenQuestion / Assumption                      (Layer 3)
  │   ← CLARIFICATION GATE : questions OPEN bloquent la génération
  │     (gate implémenté — guardNoCriticalOpenQuestions — mais non
  │      câblé automatiquement dans le pipeline — P1 AUDIT_REPORT)
  │
  ▼  [agent: dtfs-spec-writer]
SpecArtifact  (CONSTITUTION / SPEC / PLAN / TASKS)  (Layer 4)
  │
  ▼  [agent: dtfs-requirement-extractor + dtfs-platform-mapper]
Requirement → RequirementMapping               (Layer 5)
  │   ← COVERAGE GATE : Requirements HIGH non mappés bloquent
  │     (coverage-gate implémenté — non intégré au pipeline — P1)
  │
  ▼
DeltaSpec  { creates, updates, deletes }       (Layer 6)
  │
  ▼  validate_spec + governance_checks
  │  ← VALIDATE GATE : gate bloquant avant apply
  │    guardValidateBeforeApply implémenté ;
  │    NON CÂBLÉ dans applyDeltaSpec (P0 AUDIT_REPORT)
  │
ChangeSet.commit → ProjectSpec stable          (Layer 8)
  │
  ▼
RuntimeTarget  ("hono-next" par défaut)
  │
  ├─ compileBackendContract()   → BackendContract row
  ├─ compileFrontendContract()  → FrontendContract row
  └─ compileSharedContract()    → SharedContract row
                │
                ▼  validateContracts()
                │  ← CONTRACTS GATE : bloquant avant codegen
                │    implémenté — NON CÂBLÉ dans generateApp (P1 AUDIT_REPORT)
                │
  ▼  [codegen / emitters]
GeneratedArtifact rows + fichiers sur disque   (Layer 9)
  │   emit-hono.ts · emit-auth.ts · emit-prisma.ts
  │   emit-next.ts · emit-sdk.ts
  │
  ▼
TestScenario → fichiers de tests + AuditLog    (Layer 10)
  │
  ▼
Client App Runtime  (generated-app/)
```

---

## Les gates en détail

### Gate 1 — Clarification (Layer 3)

- **Condition** : toute `OpenQuestion` avec `status = "OPEN"` pour le projet bloque la génération.
- **Implémentation** : `guardNoCriticalOpenQuestions` dans `backend/src/lib/governance/guardrails.ts:299`.
- **État** : gate disponible, non activé automatiquement dans le chemin de génération (P1).

### Gate 2 — Coverage (Layer 5)

- **Condition** : tout `Requirement` de priorité HIGH sans `RequirementMapping` associé bloque l'apply.
- **Implémentation** : `backend/src/lib/coverage-gate.ts`.
- **État** : gate disponible, non intégré au pipeline apply/génération (P1).

### Gate 3 — Validate avant apply (Layer 6→8)

- **Condition** : le DeltaSpec doit passer `validateDeltaSpec` (Zod + cross-refs) avant d'être appliqué.
- **Implémentation** : `guardValidateBeforeApply` dans `guardrails.ts:245`.
- **État** : guard implémenté et testé, **non câblé** dans `applyDeltaSpec` — P0 critique. Un agent peut appliquer un spec invalide.

### Gate 4 — Validate contracts avant codegen (Layer 9)

- **Condition** : `validateContracts()` doit passer avant tout appel `generateApp`.
- **Implémentation** : `backend/src/lib/contracts/validate-contracts.ts`.
- **État** : implémenté, **non câblé** comme barrière dans `generateApp` (P1).

### Gate permanent — ChangeSet requis

- **Condition** : toute écriture sur `/api/projects/:id/*` doit être dans un ChangeSet actif.
- **Implémentation** : `backend/src/lib/changeset-middleware.ts`.
- **État** : actif et enforced.

---

## Flux inverse (revert)

```
dtfs__list_history(projectId)
  → identifier le ChangeSet cible
  → dtfs__revert_changeset(csid)
  → nouveau ChangeSet REVERT créé et commité
  → contrats recompilés depuis le spec restauré
  → (optionnel) dtfs__generate_app regénère les fichiers
```

Le revert ne supprime jamais de données — il applique les opérations inverses dans un nouveau ChangeSet.

---

## Nomenclature generate* vs emit*

- **generate*** : fonctions de haut niveau qui orchestrent la compilation des contrats + l'émission des fichiers (`generateApp`, `generateBackend`…).
- **emit*** : fonctions bas niveau qui écrivent les fichiers depuis un contrat compilé (`emit-hono.ts`, `emit-next.ts`…).
- `PlatformSpecProposal` : artefact intermédiaire entre RequirementMapping et DeltaSpec (présent dans le schéma Prisma, absent du flux documenté dans `docs/EXECUTION_FLOW.md` — P1 AUDIT_REPORT).

---

## Source of truth

`docs/EXECUTION_FLOW.md` · `docs/RUNTIME_CONTRACTS_OVERVIEW.md` · `docs/AUDIT_REPORT.md` · `backend/src/lib/governance/guardrails.ts` · `backend/src/lib/delta-spec-apply.ts` · `backend/src/codegen/codegen.ts`

## AI usage

Un agent qui exécute le pipeline doit traverser les gates dans l'ordre. Les gates P0 non enforced dans le code doivent être appelés explicitement par l'agent jusqu'à ce que le câblage soit réalisé.

## Status

partially implemented
