# Test Strategy

Suite de tests hybride en trois niveaux : déterministe, contrats LLM, app générée. 330 tests verts à la Phase 29. Commande principale : `pnpm test` depuis `backend/`.

Liens : [[GOLDEN_TESTS]] · [[CONTRACT_TESTS]] · [[GENERATED_APP_TESTS]] · [[LLM_OUTPUT_TESTS]] · [[SECURITY_TESTS]] · [[../09_ADR/ADR-0002-use-deltaspec]].

## Source of truth

`backend/src/**/*.test.ts` — 15 fichiers de test. `docs/TESTING.md` pour le guide d'exécution.

## AI usage

Les agents peuvent s'appuyer sur les tests déterministes pour vérifier leurs sorties. `assertDeltaSpecContract` est réutilisable par tout agent ou étape de pipeline.

## Status

330 tests verts / 0 fail / 0 skip (Phase 29). Baseline Phase 28 : 320 tests.

---

## Les 4 niveaux de tests

### 1. Tests déterministes (unit)

Vérifient des transformations pures — fonctions sans effets de bord, sans LLM, sans DB.

Couvrent :
- Expr DSL (validate / eval / analyze)
- Policy DSL (validate / eval)
- Operation DSL (validate / analyze)
- DeltaSpec (validate / compile / explain)
- Behavior expansion
- HTML import
- Codegen emitters + safe-path
- ChangeSet flow (mock DB)

Ces tests ne doivent jamais flapper. Pas de connexion DB requise.

### 2. Tests de contrat

Vérifient les garanties structurelles des sorties du pipeline. Déterministes (pas de LLM, pas de DB). Propriétés vérifiées : Zod-valid, pas de fonction Expr inconnue, pas de politique orpheline, les opérations QUERY ont des steps de retour.

L'helper central `assertDeltaSpecContract` (`backend/src/lib/contract/assertions.ts`) est réutilisable.

### 3. Tests golden

Verrouillent la structure des sorties de `compileProposalToDelta` contre des fixtures connues. Vérifient la présence des buckets, les nombres d'items, les noms — pas d'égalité profonde stricte (robustesse aux changements de schéma mineurs). Chaque golden fixture passe aussi `assertDeltaSpecContract`.

### 4. Tests E2E (intégration)

S'exécutent contre la vraie base PostgreSQL. Flux couvert : créer un projet éphémère → appliquer un DeltaSpec → vérifier les rows DB → committer → reverter → vérifier le rollback → codegen dryRun.

Anti-pollution stricte : projet `__test_eph_<timestamp>`, teardown en `try/finally`.

---

## Comment lancer

```bash
# Depuis backend/

# Tous les tests (unit + golden + contract + e2e) — nécessite DATABASE_URL dans ../.env
pnpm test

# Unit + golden + contract uniquement (pas de DB)
pnpm test:unit

# E2E uniquement (DB requise)
pnpm test:e2e
```

Commande exacte de `pnpm test` :
```bash
node --import tsx/esm --env-file=../.env --test \
  $(find src -name '*.test.ts' | sort | tr '\n' ' ')
```

---

## Localisation des fichiers de test

```
backend/src/
  lib/
    dsl/
      expr.test.ts                    # Expr validate + eval + analyze
      operation-dsl.test.ts           # Operation + Policy DSL
    delta-spec.test.ts                # DeltaSpec validate + compile + explain
    behavior-expand.test.ts           # Behavior expansion
    changeset-flow.test.ts            # apply_spec + revert (mock DB)
    import/
      html-import.test.ts             # HTML/Figma import pipeline
    contract/
      assertions.test.ts              # assertDeltaSpecContract helper
    governance/
      governance.test.ts              # 7 guardrails + audit trail
  codegen/
    codegen.test.ts                   # Codegen emitters + safe-path
  test/
    golden/
      fixtures.ts                     # Fixture data (pas un test)
      pipeline.golden.test.ts         # Golden + contrat compile pipeline
    e2e/
      pipeline.e2e.test.ts            # E2E : apply → commit → revert
      contracts-codegen.e2e.test.ts   # E2E : contracts → codegen (Phase 29)
```

---

## Couverture par catégorie (9/9)

| Catégorie | Fichier | Status |
|-----------|---------|--------|
| Expr DSL | `dsl/expr.test.ts` | PASS |
| Policy DSL | `dsl/operation-dsl.test.ts` | PASS |
| Operation DSL | `dsl/operation-dsl.test.ts` | PASS |
| DeltaSpec | `delta-spec.test.ts` | PASS |
| apply_spec + revert | `changeset-flow.test.ts` + e2e | PASS |
| Behavior expansion | `behavior-expand.test.ts` | PASS |
| Codegen | `codegen/codegen.test.ts` | PASS |
| Contracts pipeline | `golden/pipeline.golden.test.ts` + e2e | PASS |
| Governance guardrails | `governance/governance.test.ts` | PASS |

---

## Anti-pollution E2E

Les tests E2E qui écrivent en DB doivent :
1. Créer un projet éphémère slug `__test_eph_<timestamp>`.
2. Wrapper toute la logique en `try/finally` qui supprime le projet (cascade).
3. Ne jamais référencer le projet principal `cmpji9ev90001m5p05krcodcg`.
4. Asserter en teardown que 0 projets `__test_eph_*` restent.
