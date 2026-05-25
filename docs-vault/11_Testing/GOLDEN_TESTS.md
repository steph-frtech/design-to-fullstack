# Golden Tests

Tests golden qui verrouillent la structure des sorties du pipeline de compilation contre des fixtures connues. État : 2/6 golden complets ; 4 étapes LLM non couvertes (backlog P2).

Liens : [[TEST_STRATEGY]] · [[CONTRACT_TESTS]] · [[../03_Control_Plane/DELTASPEC]].

## Source of truth

`backend/src/test/golden/pipeline.golden.test.ts` · `backend/src/test/golden/fixtures.ts`.

## AI usage

Les agents peuvent utiliser les fixtures golden comme exemples de DeltaSpec valides. `assertDeltaSpecContract` est le helper central réutilisable.

## Status

2/6 golden actifs. 4 manquants identifiés par l'audit (backlog P2).

---

## Philosophie des golden tests

Un golden test ne vérifie pas l'égalité profonde stricte (trop fragile aux changements de schéma). Il vérifie :
- **Présence des buckets** : les buckets attendus existent dans le DeltaSpec.
- **Nombre d'items** : le bon nombre d'entités/opérations/politiques créées.
- **Noms des items** : les noms clés sont présents.
- **Contrat** : chaque fixture passe `assertDeltaSpecContract`.

---

## Golden tests existants

### Golden 1 : Proposal → DeltaSpec

**Fichier :** `backend/src/test/golden/pipeline.golden.test.ts`

**Couvre :** `compileProposalToDelta(projectId, proposalId)` → DeltaSpec structuré.

**Fixtures :** `fixtures.ts` — proposal TodoApp avec entités TodoList, TodoItem, ShareLink.

**Assertions :**
- Bucket `entities.create` présent avec 3 items (TodoList, TodoItem, ShareLink).
- Bucket `operations.create` présent.
- Bucket `resources.create` présent.
- Chaque item passe `assertDeltaSpecContract`.

**Status :** PASS.

---

### Golden 2 : Spec → Contracts (codegen contracts)

**Fichier :** `backend/src/test/golden/pipeline.golden.test.ts` + `backend/src/test/e2e/contracts-codegen.e2e.test.ts`

**Couvre :** ProjectSpec → BackendContract + FrontendContract + SharedContract.

**Assertions (Phase 29 e2e) :**

| Test | Assertion |
|------|-----------|
| BackendContract OK | routes non-vides, schemas == entités, route op présente |
| FrontendContract OK | pages == screens, format nextRoute correct |
| SharedContract OK | entity types, Zod schemas, AuthSession, 6 error codes, op input type |
| Hono API dry-run | `apps/api/` présent dans le manifest |
| Next frontend dry-run | `apps/web/` présent dans le manifest |
| SDK dry-run | `packages/shared/` présent dans le manifest |
| Artifacts créés | `.dtfs-manifest.json` + hashes SHA-256 64 chars par fichier |
| Fichier manuel protégé | `protected=true` détecté, ok=false, pas d'écriture |

**Status :** PASS (10 nouveaux tests Phase 29, +10 sur baseline 320).

---

## Golden tests manquants (backlog P2)

Ces étapes LLM produisent des sorties JSON qui devraient être verrouillées par des golden tests contractuels.

| Étape | Input → Output attendu | Priorité |
|-------|------------------------|----------|
| Prompt → ProductSpec | Texte libre → `ProductSpec` Zod-valid, tous champs requis présents | P2 |
| ProductSpec → ScreenSpec | ProductSpec + description → `ScreenSpec` Zod-valid | P2 |
| SDD Artifacts → Requirements | SDD Markdown → `Requirement[]` avec priorities et acceptanceCriteria | P2 |
| Requirements → PlatformSpecProposal | Requirements + spec → `ProposalEnvelope` avec confidenceScore ≥ 0.6 | P2 |
| PlatformSpecProposal → DeltaSpec (erreurs) | Proposal invalide → erreurs Zod listées correctement | P2 |
| DeltaSpec apply partiel | DeltaSpec avec 9 buckets `not_implemented_yet` → comportement documenté | P2 |

**Note :** Ces golden tests doivent utiliser des fixtures statiques (pas d'appel LLM réel) pour être déterministes.

---

## Helper `assertDeltaSpecContract`

**Fichier :** `backend/src/lib/contract/assertions.ts`

Vérifie pour tout DeltaSpec :
- JSON valide.
- Zod-valid contre `deltaSpecSchema`.
- Pas de fonction Expr `{call: "..."}` hors catalogue.
- Pas d'Entity référencée inexistante dans les opérations.
- Pas de Requirement critique non couvert (nécessite DB — utilisable uniquement en agents).
- Pas de fichier manuel écrasé (dans le contexte codegen).

Réutilisable par tout agent ou test de pipeline.
