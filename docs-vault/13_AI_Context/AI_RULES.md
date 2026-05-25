# AI Rules — Règles impératives DTFS

Liste exhaustive des règles que tout agent IA DOIT respecter sur ce dépôt. Chaque violation expose le projet à une corruption de spec, à une génération incontrôlée ou à une perte de données irréversible. Le statut d'enforcement est tiré de l'audit du 2026-05-25 (`docs/AUDIT_REPORT.md`).

Liens : [[AI_PROJECT_BRIEF]] · [[AI_DO_NOT_BREAK]] · [[../03_Control_Plane/GOVERNANCE]]

---

## Règles — liste exacte

### R01 — Ne jamais modifier le Control Plane hors DeltaSpec
Toute modification de la spécification projet (Entity, Operation, Policy, Screen, etc.) passe exclusivement par un `DeltaSpec` validé + appliqué via ChangeSet. Aucune écriture directe en DB Control Plane.
**Enforcement** : `changeSetMiddleware` actif sur `/api/projects/:id/*` — ENFORCED.

### R02 — Jamais apply sans validate_spec OK
`applyDeltaSpec` / `dtfs__apply_delta_spec` ne peuvent être appelés que si `validateDeltaSpec` a renvoyé `ok: true`. Utiliser `dtfs__run_governance_checks` avant.
**Enforcement** : `guardValidateBeforeApply` implémenté dans `guardrails.ts` **mais NON câblé dans le chemin d'apply** — NON ENFORCED (P0 audit).

### R03 — Jamais écrire hors ChangeSet
Tout `apply_spec` ou `apply_delta_spec` DOIT être enveloppé dans un `begin_changeset` / `commit_changeset`. Sans `changeSetId` actif, l'appel doit être rejeté.
**Enforcement** : runtime server + hook `dtfs-guard-apply.sh` (PreToolUse) — ENFORCED (double couche).

### R04 — Jamais générer du code directement depuis Entity/Operation/Screen si les contrats existent
Le codegen doit toujours passer par la couche `BackendContract` → `FrontendContract` → `SharedContract`. Ne jamais lire `projectSpec` brut dans `generate_app` pour émettre du code si `compile_*_contract` est disponible. Exception documentée : `emit-prisma.ts` lit le spec brut (voulu, documenté).
**Enforcement** : `generateApp` compile les 3 contrats, mais `validateContracts` n'est pas un gate bloquant — PARTIELLEMENT ENFORCED (P1 audit).

### R05 — Toujours passer par Backend/Frontend/SharedContract
L'ordre canonique de compilation est : `compile_shared_contract` → `compile_backend_contract` → `compile_frontend_contract` → `validate_contracts`. Ne pas inverser cet ordre, ne pas sauter `validate_contracts`.
**Enforcement** : documenté dans `HARNESS.md` et `/dtfs:generate-app` — NON ENFORCED en dur dans le code (P1 audit).

### R06 — Jamais mélanger Control Plane DB et Client App DB
La base de données PostgreSQL du Control Plane (`backend/prisma/schema.prisma`) ne doit jamais recevoir de tables applicatives de l'app cliente générée. Le schéma de l'app cliente est émis par `emit-prisma.ts` dans `outDir/`.
**Enforcement** : isolation architecturale par design — ENFORCED (pas de chemin de code possible).

### R07 — Jamais stocker les sessions Better Auth client dans le Control Plane
Better Auth de l'app cliente est généré dans `apps/api/src/auth.ts` (outDir). Les sessions/utilisateurs de l'app générée n'ont aucun lien avec le Control Plane.
**Enforcement** : `emit-auth.ts` cantonne l'output à `apps/api/src/auth.ts` — ENFORCED.

### R08 — Jamais écraser un fichier manuel sans protection
Un fichier marqué `protected: true` dans le manifest `GeneratedArtifact` ne peut pas être réécrit par `generate_app`. Si `protected` est `false`, un fichier absent du manifest précédent ne doit pas être écrasé sans alerte.
**Enforcement** : `ManifestEntry.protected` codé en dur à `false` dans `codegen/types.ts:23` → la protection ne se déclenche jamais — NON ENFORCED (P0 audit).

### R09 — Jamais inventer une fonction Expr
Le catalogue des fonctions Expr est fermé à 8 entrées : `lowercase`, `uppercase`, `trim`, `concat`, `length`, `now`, `uuid`, `randomToken`. Toute autre valeur dans `{ call: "..." }` est un rejet dur.
**Enforcement** : `guardNoUnknownExprFunctions` dans `guardrails.ts:219` + `expr-validate.ts:110` — ENFORCED + testé.

### R10 — Jamais ignorer une OpenQuestion critique
Si `checkClarificationGate` détecte des `OpenQuestion` ou `Assumption` de statut `OPEN`, la génération de code est bloquée. Ne pas contourner ce gate.
**Enforcement** : `guardNoCriticalOpenQuestions` implémenté, mais **non activé automatiquement** dans le pipeline (flag jamais passé) — NON ENFORCED (P1 audit).

### R11 — Toujours tracer les fichiers générés dans GeneratedArtifact
Tout fichier produit par un `generate_app` non-dryRun doit créer une ligne `GeneratedArtifact` avec `contentHash`, `path`, `ownership`. L'option `trackArtifacts: true` est obligatoire.
**Enforcement** : `guardCodegenNeedsArtifactTracking` actif pour non-dryRun ; `protected` toujours `false` (voir R08) — PARTIELLEMENT ENFORCED (P1 audit).

### R12 — Toujours documenter les décisions structurantes via ADR
Toute décision d'architecture (nouveau DSL, changement de schéma, nouveau RuntimeTarget) doit être tracée dans le vault sous `docs/ADR/` ou équivalent, avec date et contexte.
**Enforcement** : convention documentée uniquement — NON ENFORCED automatiquement.

---

## Résumé des statuts d'enforcement

| Règle | Statut | Priorité |
|---|---|---|
| R01 — écriture hors DeltaSpec | ENFORCED | — |
| R02 — apply sans validate | NON ENFORCED | **P0** |
| R03 — écriture hors ChangeSet | ENFORCED | — |
| R04 — codegen via contrats | PARTIELLEMENT | P1 |
| R05 — ordre de compilation | NON ENFORCED | P1 |
| R06 — isolation DB | ENFORCED | — |
| R07 — isolation Better Auth | ENFORCED | — |
| R08 — protection fichiers manuels | NON ENFORCED | **P0** |
| R09 — fonctions Expr inventées | ENFORCED | — |
| R10 — questions critiques ouvertes | NON ENFORCED | P1 |
| R11 — traçabilité GeneratedArtifact | PARTIELLEMENT | P1 |
| R12 — ADR | NON ENFORCED | P2 |

## Source of truth

`docs/GOVERNANCE.md` · `backend/src/lib/governance/guardrails.ts` · `docs/AUDIT_REPORT.md`

## AI usage

Consulter ce fichier avant tout apply ou generate. En cas de doute sur l'enforcement, traiter la règle comme non-enforced et appliquer la garde manuellement.

## Status

Stable — basé sur l'audit 2026-05-25. Les P0 (R02, R08) ne sont pas encore corrigés dans le code.
