# SECURITY_MODEL

Le modèle de sécurité de DTFS repose sur sept garde-fous déclaratifs qui encadrent chaque opération sensible. Certains sont actifs et enforced ; d'autres sont implémentés mais non encore câblés dans le chemin d'exécution (P0/P1 selon l'audit 2026-05-25).

Liens : [[ARCHITECTURE_OVERVIEW]] · [[CONTROL_PLANE]] · [[SEPARATION_OF_CONCERNS]] · [[EXECUTION_FLOW]]

---

## Les sept garde-fous

### GF-01 — Écriture hors ChangeSet interdite

**Règle** : toute écriture sur le Control Plane (POST/PUT/PATCH/DELETE sur `/api/projects/:id/*`) doit être effectuée dans le contexte d'un ChangeSet actif.

**Implémentation** : `backend/src/lib/changeset-middleware.ts` — middleware HTTP enforced sur toutes les routes projet.

**État** : actif et enforced. Retourne 422 si `X-ChangeSet-Id` absent.

---

### GF-02 — Apply sans validate interdit

**Règle** : `applyDeltaSpec` doit refuser tout DeltaSpec qui n'a pas passé `validateDeltaSpec` (validation structurelle Zod + cross-refs entités/opérations).

**Implémentation** : `guardValidateBeforeApply` dans `backend/src/lib/governance/guardrails.ts:245`.

**État** : guard implémenté et testé. **Non câblé** dans `applyDeltaSpec` — **P0 critique** (AUDIT_REPORT). Un agent peut actuellement appliquer un spec invalide sans blocage.

**Correction requise** : appeler `guardValidateBeforeApply` dans `applyDeltaSpec` et refuser si `!ok`.

---

### GF-03 — Génération sans contrats valides interdite

**Règle** : `generateApp` (codegen non-dryRun) doit refuser si `validateContracts()` n'a pas passé.

**Implémentation** : `backend/src/lib/contracts/validate-contracts.ts`.

**État** : gate disponible, **non câblé** dans `generateApp` — P1 (AUDIT_REPORT). Du code peut être généré depuis des contrats invalides.

---

### GF-04 — Secrets jamais en clair

**Règle** : aucun secret (clé API, password, token) ne peut être stocké en clair dans un DeltaSpec ou dans le Control Plane. Seules les références (`secretRef:env:VAR`, `vault:`, `$ref:`) sont autorisées.

**Implémentation** : `guardNoInlineSecrets` dans `guardrails.ts:129` — testé, actif.

**Patterns détectés** : noms de champs (`password`, `apiKey`, `token`…) avec valeurs littérales ; préfixes connus (`sk_live_`, `AKIA`, `ghp_`, `glpat-`…) ; chaînes base64/hex longues.

**État** : implémenté et testé.

---

### GF-05 — Pas de fonction Expr inventée

**Règle** : tout noeud `{ call: "..." }` dans un Expr AST doit référencer une fonction du catalogue fermé de 8 fonctions : `lowercase`, `uppercase`, `trim`, `concat`, `length`, `now`, `uuid`, `randomToken`.

**Implémentation** : `guardNoUnknownExprFunctions` dans `guardrails.ts:219` + `expr-validate.ts:110`.

**État** : implémenté et testé. Rejet strict des fonctions inconnues.

---

### GF-06 — Pas d'écrasement de fichier manuel

**Règle** : un fichier généré modifié manuellement (marqué `protected = true` dans `GeneratedArtifact`) ne peut pas être écrasé par une régénération.

**Implémentation** : `ManifestEntry.protected` dans `backend/src/codegen/types.ts:23`.

**État** : `protected` codé en dur à `false` → **jamais effectif — P0 critique** (AUDIT_REPORT). Tout fichier peut être écrasé silencieusement lors d'une régénération.

**Correction requise** : détecter les fichiers absents du manifest précédent ou marqués `protected` et refuser l'écrasement (pas seulement signaler).

---

### GF-07 — Isolation des bases de données

**Règle** : la base Control Plane (`dtfs`) et la base app cliente (`gen_<slug>`) ne partagent aucune table ni connexion. Voir [[SEPARATION_OF_CONCERNS]].

**Implémentation** : architecturale — deux connexions Prisma distinctes, deux schémas distincts.

**État** : conforme (AUDIT_REPORT ligne 84 — "Garde-fou Better Auth isolé : conforme").

---

## Governance Report

L'agrégateur `runGovernanceChecks(projectId, deltaSpec, opts)` combine plusieurs guards et retourne :

```ts
type GovernanceReport = {
  ok: boolean                 // false si une violation a severity "block"
  violations: GovernanceViolation[]
  passed: string[]            // codes des guards passés
}
```

Retourne HTTP 422 avec `{ "error": "governance_violation", "violations": [...] }` si `ok === false`.

MCP tool : `dtfs__run_governance_checks { projectId, deltaSpec, confirmDeletes? }`.

---

## AuditLog

Chaque action sensible est enregistrée dans `/tmp/dtfs-audit.jsonl` (JSONL, jamais dans le repo Git).

| Action auditée | Déclencheur |
|---|---|
| `apply_delta` | `POST /:id/apply` ou `/:id/delta-spec/apply` |
| `commit_changeset` | `POST /:id/changesets/:csid/commit` |
| `revert_changeset` | `POST /:id/changesets/:csid/revert` |
| `generate_app` | `POST /:id/codegen` (non-dryRun) |

Option `DTFS_AUDIT_DB=1` pour persister aussi dans `prisma.auditLog` (nécessite migration `phase_10_enriched_models`).

---

## État des P0 de sécurité (AUDIT_REPORT)

| Garde-fou | État |
|---|---|
| GF-01 ChangeSet requis | Actif |
| GF-02 Apply sans validate | **P0 — non câblé** |
| GF-03 Génération sans contrats valides | P1 — non câblé |
| GF-04 Secrets en clair | Actif |
| GF-05 Expr inventée | Actif |
| GF-06 Écrasement fichier manuel | **P0 — `protected` toujours false** |
| GF-07 Isolation des bases | Actif |

> Risque principal (extrait AUDIT_REPORT) : le système donne l'apparence d'un pipeline gouverné, mais à l'exécution réelle un agent peut appliquer un DeltaSpec non validé, générer sans contrats valides et écraser un fichier manuel. Les trois impératifs §18 ne sont pas barrés dans le code.

---

## Source of truth

`docs/GOVERNANCE.md` · `backend/src/lib/governance/guardrails.ts` · `backend/src/lib/governance/governance-check.ts` · `docs/AUDIT_REPORT.md` (P0/P1)

## AI usage

Avant toute opération d'apply ou de codegen, un agent doit appeler `dtfs__run_governance_checks`. Tant que GF-02 et GF-06 sont des P0 non corrigés, l'agent doit pallier manuellement en appelant `dtfs__validate_spec` avant `dtfs__apply_delta_spec`.

## Status

partially implemented
