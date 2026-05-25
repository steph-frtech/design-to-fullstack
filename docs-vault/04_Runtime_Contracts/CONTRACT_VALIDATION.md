# CONTRACT_VALIDATION

`validateContracts(projectId)` effectue des checks croisés sur les trois contrats compilés pour garantir leur cohérence avant le codegen. Elle vérifie que chaque route backend a un schéma, que chaque `dataBinding` frontend pointe vers une source existante, que les types partagés couvrent tous les schémas backend, et que les policies ne sont pas orphelines.

Liens : [[BACKEND_CONTRACT]] · [[FRONTEND_CONTRACT]] · [[SHARED_CONTRACT]] · [[CONTRACT_COMPILATION]] · [[../05_Generated_App/GENERATED_ARTIFACTS]]

---

## Source of truth

`docs/VALIDATION.md` · `backend/src/lib/contracts/validate-contracts.ts`

---

## Shape du résultat

```ts
type ContractValidationResult = {
  ok: boolean;
  errors: ContractValidationError[];
  summary: {
    backendRoutes: number;
    frontendPages: number;
    sharedTypes: number;
    checks: number;
    passed: number;
  };
};

type ContractValidationError = {
  code: string;
  contract: "backend" | "frontend" | "shared" | "cross";
  message: string;
};
```

---

## Checks actuellement implémentés

| Check | Code d'erreur | Contrat |
|---|---|---|
| Chaque schéma backend a un type partagé correspondant | `missing_shared_type` | `cross` |
| Chaque route backend a un `schemaRef` ou `operationRef` | `route_missing_schema` | `backend` |
| Chaque page frontend a au moins une route correspondante | `page_without_route` | `frontend` |
| Chaque `dataBinding` pointe vers un endpoint backend existant | `binding_missing_endpoint` | `cross` |

---

## Checks prévus (non encore implémentés)

- Policy orpheline (policy référencée par une route sans middleware correspondant)
- Type partagé manquant pour un payload d'événement
- `authGuard` frontend sans route protégée côté backend

---

## Statut dans le pipeline

`validateContracts` est **implémentée** mais **pas encore un gate bloquant** dans `generateApp` (AUDIT_REPORT P1). Elle est disponible comme outil séparé (`dtfs__validate_contracts`) mais `generateApp` ne l'appelle pas en barrière.

```
ÉTAT ACTUEL :
generateApp()
  → compileBackendContract
  → compileFrontendContract
  → compileSharedContract
  → (validateContracts NON appelée automatiquement ici)
  → emitters

ÉTAT CIBLE :
generateApp()
  → compileBackendContract
  → compileFrontendContract
  → compileSharedContract
  → validateContracts  ← gate bloquant : si !ok → throw governance_violation
  → emitters
```

---

## AI usage

Appeler `dtfs__validate_contracts` manuellement avant `dtfs__generate_app` jusqu'à ce que le gate soit câblé. Si `ok: false`, corriger le ProjectSpec (via DeltaSpec) avant de relancer le codegen. Ne pas contourner ce check.

## Status

`documented` — `validateContracts` implémentée dans `validate-contracts.ts` ; **pas encore un gate bloquant dans `generateApp`** (AUDIT_REPORT P1 — à corriger en priorité).
