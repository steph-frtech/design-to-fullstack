# Security Tests

Tests des garde-fous de sécurité (governance.test.ts) et des règles d'enforcement. Tous déterministes, pas de DB requise.

Liens : [[TEST_STRATEGY]] · [[LLM_OUTPUT_TESTS]] · [[../10_Agents_MCP_Skills/SAFETY_RULES]] · [[../09_ADR/ADR-0003-use-changesets]].

## Source of truth

`backend/src/lib/governance/governance.test.ts` · `backend/src/lib/governance/guardrails.ts`.

## AI usage

Ces tests vérifient que les guardrails refusent bien les entrées malveillantes ou incorrectes. Les agents n'ont pas à les appeler directement — les guardrails s'exécutent automatiquement via les endpoints MCP.

## Status

Actif. Tous les tests de sécurité passent (inclus dans les 330 verts).

---

## Comment lancer les tests de sécurité seuls

```bash
cd backend
node --import tsx/esm --test src/lib/governance/governance.test.ts
```

Pas de `--env-file` nécessaire (pas de DB).

---

## Couverture des guardrails testés

### Guardrail 2 — Secrets en clair (`guardNoInlineSecrets`)

| Cas de test | Input | Résultat attendu |
|-------------|-------|-----------------|
| Clé Stripe live | `{apiKey: "sk_live_abc123"}` | VIOLATION (code: `inline_secrets_detected`) |
| Token GitHub | `{value: "ghp_AAABBB..."}` | VIOLATION |
| Référence secrète valide | `{apiKey: "secretRef:env:STRIPE_KEY"}` | OK |
| Référence env valide | `{password: "env:DB_PASS"}` | OK |
| Valeur base64 longue | 40+ chars hex/base64 | VIOLATION |

### Guardrail 3 — Suppression sans confirmation (`guardDeleteRequiresValidation`)

| Cas de test | Input | Résultat attendu |
|-------------|-------|-----------------|
| Delete sans confirmDeletes | `{entities: {delete: [{id: "x"}]}}` | VIOLATION (code: `delete_requires_validation`) |
| Delete avec confirmDeletes=true | idem + `confirmDeletes: true` | OK |
| DeltaSpec sans delete | `{entities: {create: [...]}}` | OK |

### Guardrail 4 — Fonction Expr inconnue (`guardNoUnknownExprFunctions`)

| Cas de test | Input | Résultat attendu |
|-------------|-------|-----------------|
| Fonction inventée | `{call: "hackzor", args: []}` | VIOLATION (code: `unknown_expr_functions`) |
| Fonction valide | `{call: "lowercase", args: [{lit: "X"}]}` | OK |
| Injection via opération | Operation avec step `{expr: {call: "eval", args: []}}` | VIOLATION |

### Guardrail 5 — Validate before apply (`guardValidateBeforeApply`)

| Cas de test | Input | Résultat attendu |
|-------------|-------|-----------------|
| DeltaSpec structurellement invalide | Champ requis manquant | VIOLATION (code: `validate_before_apply`) |
| DeltaSpec valid | Spec Zod-valid + cross-refs OK | OK |

### Audit Log — Round-trip

| Cas de test | Action | Résultat attendu |
|-------------|--------|-----------------|
| Émettre un événement | `emitAuditEvent({action: "apply_delta", ...})` | Événement écrit dans `/tmp/dtfs-audit-test.jsonl` |
| Lire les événements | `readAuditLog({limit: 10})` | Événement récupéré, chronologie inversée |
| Filtrer par action | `readAuditLog({action: "apply_delta"})` | Seulement les events apply_delta |

### Agrégation via `runGovernanceChecks`

| Cas de test | Input | Résultat attendu |
|-------------|-------|-----------------|
| DeltaSpec avec secrets + fonction inconnue | Deux violations | `{ok: false, violations: [{code: "inline_secrets_detected"}, {code: "unknown_expr_functions"}]}` |
| DeltaSpec propre | Spec valide | `{ok: true, violations: [], passed: [...]}` |

---

## Safe-path enforcement

Testé dans `backend/src/codegen/codegen.test.ts` :

| Cas de test | Input | Résultat attendu |
|-------------|-------|-----------------|
| OutDir dans le repo DTFS | `/data/dev/design-to-fullstack/generated` | Erreur levée |
| OutDir dans `/tmp` | `/tmp/dtfs-test-<id>` | Accepté |
| OutDir dans localPath/generated | `<project.localPath>/generated` | Accepté |
| OutDir vide | `""` | Erreur levée |
| OutDir relatif | `./generated` | Erreur levée (chemin absolu requis) |

---

## Lacunes de sécurité identifiées (non testées)

| Garde-fou | Lacune |
|-----------|--------|
| Apply sans validation (P0) | `guardValidateBeforeApply` testé unitairement mais pas enforced dans `applyDeltaSpec` — un test d'intégration devrait vérifier que l'apply rejette un DeltaSpec invalide sans passer par `runGovernanceChecks` explicitement |
| Fichier manuel écrasé (P0) | `protected: true` jamais déclenché — pas de test d'écrasement de fichier manuel |
| Questions critiques ouvertes | `guardNoCriticalOpenQuestions` testé unitairement, mais le gate n'étant pas actif dans le pipeline, pas de test E2E de blocage |
