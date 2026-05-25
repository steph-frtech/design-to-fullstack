# Safety Rules

Les garde-fous du système DTFS et leur état d'implémentation (implémenté / partiel / manquant). Source : §18 du rapport d'audit.

Liens : [[HOOKS]] · [[../09_ADR/ADR-0002-use-deltaspec]] · [[../09_ADR/ADR-0003-use-changesets]] · [[../13_AI_Context/AI_RULES]] (si présent).

## Source of truth

`backend/src/lib/governance/guardrails.ts` · `backend/src/lib/governance/governance-check.ts` · `backend/src/lib/changeset-middleware.ts`.

## AI usage

Les agents doivent respecter ces règles implicitement via le pipeline (DeltaSpec → validate → apply). Les guards sont des filets de sécurité, pas des substituts au respect du pipeline.

## Status

7 guardrails implémentés. P0 : 2 non enforcés dans le chemin d'exécution. P1 : 4 partiellement actifs.

---

## Les 7 Guardrails

### 1. Écriture hors ChangeSet — `guardChangeSetRequired`

| Aspect | Détail |
|--------|--------|
| Implémentation | `backend/src/lib/changeset-middleware.ts` |
| État | **Implémenté et enforced** |
| Mécanisme | `changeSetMiddleware` auto-wraps tous les POST/PUT/PATCH/DELETE sous `/:id/*`. Renvoie 422 si pas de `changeSetId` actif. |
| Hook additionnel | `dtfs-guard-apply.sh` (PreToolUse) — deuxième couche côté Claude Code |

---

### 2. Secrets en clair — `guardNoInlineSecrets`

| Aspect | Détail |
|--------|--------|
| Implémentation | `backend/src/lib/governance/guardrails.ts:129` |
| État | **Implémenté et enforced** — testé dans `governance.test.ts` |
| Mécanisme | Scan heuristique sur les noms de champs (`password`, `secret`, `apiKey`, `token`) + valeurs (`sk_live_`, `ghp_`, etc.). Accepte les références `secretRef:env:X`. |
| Tests | `governance.test.ts` : `sk_live_xxx` → violation ; `secretRef:env:X` → OK |

---

### 3. Fonction Expr inconnue — `guardNoUnknownExprFunctions`

| Aspect | Détail |
|--------|--------|
| Implémentation | `backend/src/lib/governance/guardrails.ts:219` + `expr-validate.ts:110` |
| État | **Implémenté et enforced** — rejet strict |
| Mécanisme | Catalogue fermé de 8 fonctions : `lowercase`, `uppercase`, `trim`, `concat`, `length`, `now`, `uuid`, `randomToken`. Tout `{call: "..."}` hors catalogue est bloqué. |

---

### 4. Suppression sans confirmation — `guardDeleteRequiresValidation`

| Aspect | Détail |
|--------|--------|
| Implémentation | `backend/src/lib/governance/guardrails.ts` |
| État | **Implémenté et enforced** |
| Mécanisme | Tout DeltaSpec avec un bucket `.delete[]` non-vide nécessite `confirmDeletes: true` explicite dans l'appel. |

---

### 5. Apply sans validation — `guardValidateBeforeApply`

| Aspect | Détail |
|--------|--------|
| Implémentation | `backend/src/lib/governance/guardrails.ts:245` |
| État | **P0 — Implémenté mais NON enforced dans le chemin d'exécution** |
| Problème | `dtfs__apply_delta_spec` / `dtfs__apply_spec` appellent `applyDeltaSpec` directement (seul un parse Zod). `guardValidateBeforeApply` / `runGovernanceChecks` ne sont pas appelés dans `applyDeltaSpec`. |
| Risque | Un agent peut appliquer un DeltaSpec structurellement invalide. |
| Correction | Appeler `guardValidateBeforeApply` dans `applyDeltaSpec` et refuser si `!ok`. (`mcp.ts:414`, `lib/delta-spec-apply.ts`) |

---

### 6. Questions critiques ouvertes — `guardNoCriticalOpenQuestions`

| Aspect | Détail |
|--------|--------|
| Implémentation | `backend/src/lib/governance/guardrails.ts:299` + `lib/clarification-gate.ts` |
| État | **P1 — Gate non activé automatiquement** |
| Problème | Le flag `checkClarificationGate` n'est jamais passé dans les chemins apply/génération normaux. |
| Risque | Génération possible malgré des questions critiques non résolues. |

---

### 7. Requirements prioritaires non mappés — coverage-gate

| Aspect | Détail |
|--------|--------|
| Implémentation | `backend/src/lib/coverage-gate.ts` |
| État | **P1 — Détection présente, non intégrée au pipeline** |
| Problème | `checkCoverageGate` est disponible comme outil MCP (`dtfs__validate_requirement_coverage`) mais n'est pas un gate bloquant dans apply ou génération. |

---

### 8. Génération sans contrats valides

| Aspect | Détail |
|--------|--------|
| Implémentation | `mcp.ts:1888`, `lib/contracts/validate-contracts.ts` |
| État | **P1 — Non gate dans generateApp** |
| Problème | `dtfs__validate_contracts` n'est pas appelé automatiquement dans `generateApp`. L'orchestrateur le fait, mais pas le code sous-jacent. |

---

### 9. Fichier manuel écrasé — protection fichiers

| Aspect | Détail |
|--------|--------|
| Implémentation | `codegen/types.ts:23` + `codegen.ts:378-411` |
| État | **P0 — Protection non fonctionnelle** |
| Problème | `ManifestEntry.protected` est codé en dur à `false` → la détection "ne pas écraser un fichier manuel" ne se déclenche jamais. |
| Risque | Un `generate` non-dryRun peut écraser un fichier édité à la main sans alerte. |
| Correction | Rendre `protected` réel (détecter les fichiers absents du manifest précédent / marqués protected) et bloquer l'écrasement. |

---

### 10. Better Auth isolé

| Aspect | Détail |
|--------|--------|
| Implémentation | `codegen/emit-auth.ts` |
| État | **Implémenté** |
| Mécanisme | La génération auth est cantonnée à `apps/api/src/auth.ts`. Aucun autre émetteur n'importe Better Auth directement. |

---

### 11. Frontend via SDK typé (objectif)

| Aspect | Détail |
|--------|--------|
| Implémentation | `emit-next.ts:166`, `emit-sdk.ts` |
| État | **P2 — SDK généré mais pages stubs ne l'importent pas** |

---

### 12. Policies backend ≠ guards frontend

| Aspect | Détail |
|--------|--------|
| Implémentation | `emit-hono.ts:359-374` |
| État | **P1 — Middlewares générés en stubs pass-through** |
| Problème | La compilation `PolicyRule → middleware Hono` réel n'est pas implémentée. |

---

## Récapitulatif priorisation

| Priorité | Règle | État |
|----------|-------|------|
| P0 | Apply sans validation | Non enforced |
| P0 | Fichier manuel écrasé | `protected` toujours false |
| P1 | Questions critiques ouvertes | Gate jamais passé |
| P1 | Requirements non mappés | Non intégré pipeline |
| P1 | Génération sans contrats valides | Non gate dans generateApp |
| P1 | Middlewares policy | Stubs pass-through |
| OK | Écriture hors ChangeSet | Enforced |
| OK | Secrets en clair | Enforced + testé |
| OK | Fonction Expr inconnue | Enforced + testé |
| OK | Suppression sans confirmation | Enforced |
| OK | Better Auth isolé | Implémenté |
