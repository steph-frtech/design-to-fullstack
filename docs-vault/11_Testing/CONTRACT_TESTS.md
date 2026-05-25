# Contract Tests

Tests de compilation des contrats et de cohérence structurelle du pipeline. Déterministes (pas de LLM, pas de DB pour les unit contracts). E2E pour la validation cross-contrats.

Liens : [[TEST_STRATEGY]] · [[GOLDEN_TESTS]] · [[../04_Runtime_Contracts/RUNTIME_CONTRACTS_OVERVIEW]].

## Source of truth

`backend/src/lib/contract/assertions.ts` · `backend/src/test/e2e/contracts-codegen.e2e.test.ts`.

## AI usage

Les agents de compilation de contrats peuvent utiliser `assertDeltaSpecContract` pour valider leurs sorties avant de les persister.

## Status

Actif. Tous les tests contracts passent (inclus dans les 330 verts Phase 29).

---

## Tests unitaires de contrat (pas de DB)

### `assertions.test.ts`

**Fichier :** `backend/src/lib/contract/assertions.test.ts`

**Helper central :** `assertDeltaSpecContract(spec, context?)`

**Propriétés vérifiées :**

| Propriété | Assertion |
|-----------|-----------|
| JSON valide | Le DeltaSpec se parse sans erreur |
| Zod-valid | `deltaSpecSchema.parse(spec)` sans erreur |
| Pas de fonction Expr inconnue | Aucun `{call: "..."}` hors du catalogue de 8 fonctions |
| Pas d'Entity inexistante | Toutes les entités référencées dans operations/policies existent |
| Opérations QUERY ont un return step | Pas de QUERY sans `{kind: "return"}` dans le body |
| Pas de politique orpheline | Toute Policy référence une Operation existante |

**Usage dans un agent :**
```typescript
import { assertDeltaSpecContract } from "../lib/contract/assertions.ts";
assertDeltaSpecContract(deltaSpec, { existingEntityNames: [...] });
// Lance une Error si une propriété est violée
```

---

## Tests E2E des contrats (DB requise)

### `contracts-codegen.e2e.test.ts`

**Fichier :** `backend/src/test/e2e/contracts-codegen.e2e.test.ts`

**Projet éphémère :** `__test_cg29_<timestamp>` (Article + Comment, 2 resources, 1 screen, 1 operation).

**Tests (10 au total) :**

| Test | Description |
|------|-------------|
| BackendContract → routes non-vides | Routes générées quand resources existent |
| BackendContract → schemas == entités | Nombre de schemas == nombre d'entités |
| FrontendContract → pages == screens | Nombre de pages == nombre de screens |
| FrontendContract → nextRoute correct | Format `/app/<slug>/page.tsx` |
| SharedContract → entity types | Types DTO pour chaque entité |
| SharedContract → Zod schemas | Schema Zod par entité |
| SharedContract → AuthSession | Type AuthSession présent |
| SharedContract → 6 error codes | 6 codes d'erreur standard toujours présents |
| validateContracts | `ok=true` ou `ok=false` avec erreurs structurées (pas de crash) |
| generateApp dryRun | Manifest contient `apps/api/`, `apps/web/`, `packages/shared/` |

---

## Tests de compilation croisée

### Validation cross-contrats — `validateContracts`

`dtfs__validate_contracts(projectId)` lance 7 checks de cohérence :

| Check | Description |
|-------|-------------|
| 1 | Toute route backend a une page frontend correspondante |
| 2 | Tout type de réponse operation est dans le SharedContract |
| 3 | Tout Zod schema référencé dans BackendContract existe dans SharedContract |
| 4 | AuthSession cohérent entre Backend et SharedContract |
| 5 | Pas de route orpheline (dans Backend mais pas dans FrontendContract) |
| 6 | Pas d'import circulaire entre les contrats |
| 7 | outputDir résolu et accessible |

**Si `ok: false` :** l'orchestrateur bloque la génération et appelle `dtfs__explain_contracts` pour détail.

---

## Relation avec les tests golden

Les tests golden de `pipeline.golden.test.ts` appellent `assertDeltaSpecContract` sur chaque fixture. Les tests de contrat E2E vérifient la compilation effective depuis la DB. Les deux niveaux sont complémentaires :
- Golden : fixture statique, déterministe, vérifie la structure du DeltaSpec.
- E2E : vraie DB, vérifie la compilation et la cohérence des contrats compilés.
