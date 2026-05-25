# CONTRACT_COMPILATION

La phase de compilation des contrats est l'étape intermédiaire obligatoire entre le `ProjectSpec` commis (ChangeSet) et le codegen. Elle transforme les concepts Control Plane en représentations persistées (`BackendContract`, `FrontendContract`, `SharedContract`) que les emitters lisent ensuite. La compilation est **read-only** et **in-memory par défaut** (persistance en DB conditionnée à la migration Phase 25).

Liens : [[RUNTIME_TARGET]] · [[BACKEND_CONTRACT]] · [[FRONTEND_CONTRACT]] · [[SHARED_CONTRACT]] · [[CONTRACT_VALIDATION]]

---

## Source of truth

`docs/RUNTIME_CONTRACTS_OVERVIEW.md` · `backend/src/lib/contracts/compile-backend.ts` · `backend/src/lib/contracts/compile-frontend.ts` · `backend/src/lib/contracts/compile-shared.ts`

---

## Pipeline complet

```
DeltaSpec
  → ChangeSet (commis)
  → ProjectSpec (snapshot stable)
  → compileBackendContract(projectId)   → BackendContract
  → compileFrontendContract(projectId)  → FrontendContract
  → compileSharedContract(projectId)    → SharedContract  ← lit les deux précédents
  → validateContracts(projectId)        → gate (P1 : pas encore bloquant dans generateApp)
  → generateApp()                       → GeneratedArtifact rows + fichiers
```

---

## Fonctions réelles (lib/contracts/)

| Fichier | Fonction exportée | Entrée | Sortie |
|---|---|---|---|
| `compile-backend.ts` | `compileBackendContract(projectId)` | projectId | `BackendContractObj` |
| `compile-frontend.ts` | `compileFrontendContract(projectId)` | projectId | `FrontendContractObj` |
| `compile-shared.ts` | `compileSharedContract(projectId)` | projectId | `SharedContractObj` |
| `validate-contracts.ts` | `validateContracts(projectId)` | projectId | `ContractValidationResult` |
| `explain-contracts.ts` | `explainContracts(projectId)` | projectId | résumé lisible |
| `runtime-target.ts` | `getRuntimeTarget(projectId)` | projectId | `RuntimeTargetResult` (DB ou défaut) |

---

## Ordre d'exécution obligatoire

```
1. getRuntimeTarget          → charge ou initialise la cible tech
2. compileBackendContract    → Entity/Resource/Operation/Policy/AuthMethod/Asset/Event
3. compileFrontendContract   → Screen/Component/Form/Field/Action/DataBinding/Policy/Translation/Theme
4. compileSharedContract     → lit BackendContract + FrontendContract
5. validateContracts         → checks croisés (route↔schéma, dataBinding↔source, policy orpheline…)
```

`compileSharedContract` dépend des deux précédents. Toute exécution hors ordre produit un contrat incomplet.

---

## Caractéristiques de la compilation

- **Lecture seule** : aucun concept Control Plane n'est modifié.
- **In-memory par défaut** : les objets contrats sont retournés en mémoire ; la persistance en DB est séparée.
- **Déterministe** : même ProjectSpec → mêmes contrats (ordre d'itération stable).
- **Idempotente** : re-compiler avec le même ProjectSpec écrase la ligne DB existante (pas de doublon).

---

## Ce que la compilation ne fait pas

- Elle ne valide pas le DeltaSpec (ce gate est en amont, dans `applyDeltaSpec`).
- Elle ne génère pas de code (c'est le rôle des emitters Phase 28).
- Elle ne déclenche pas de migrations Prisma.

---

## AI usage

Toujours exécuter les trois compilateurs dans l'ordre avant d'appeler `generateApp`. Si `validateContracts` retourne `ok: false`, ne pas lancer le codegen. L'outil MCP `dtfs__compile_contracts` encapsule les trois étapes + validate.

## Status

`documented` — les trois compilateurs sont implémentés ; `validateContracts` implémenté mais **pas encore un gate bloquant dans `generateApp`** (AUDIT_REPORT P1) ; persistance DB disponible via les modèles Phase 25.
