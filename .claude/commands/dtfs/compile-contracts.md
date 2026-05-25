---
description: "Compile les trois contrats (Backend, Frontend, Shared) et les valide. Phase 26."
---

Compile les contrats BackendContract, FrontendContract et SharedContract
dans l'ordre correct, valide leur cohérence mutuelle, et explique les
erreurs éventuelles.

## Cible

$ARGUMENTS

## Format attendu

`<projectId>`

## Instructions

1. Identifier le `projectId` depuis `$ARGUMENTS`. Si absent, appeler
   `dtfs__list_projects` et demander.

2. Vérifier qu'un RuntimeTarget existe via `dtfs__get_runtime_target(projectId)`.
   Si absent, arrêter : "Aucun RuntimeTarget — lancer `/dtfs:set-runtime` d'abord."

3. Compiler dans l'ordre (chaque contrat dépend du précédent) :
   - `dtfs__compile_shared_contract(projectId)` — types partagés en premier.
   - `dtfs__compile_backend_contract(projectId)` — routes + auth.
   - `dtfs__compile_frontend_contract(projectId)` — pages + data bindings.

4. Valider : `dtfs__validate_contracts(projectId)`.
   - Si `ok: false` : appeler `dtfs__explain_contracts(projectId)` et afficher
     chaque erreur avec son chemin et une suggestion de correction. Verdict
     final : `BLOCKED`.
   - Si `ok: true` : afficher un résumé succinct des trois contrats.

5. Si la validation passe, appeler `dtfs__explain_contracts(projectId)` et
   présenter l'explication à l'utilisateur (résumé en markdown).

6. Afficher le tableau récapitulatif :

```
## Contrats compilés — <projectId>

| Contrat          | Routes/Pages/Types | Statut |
|------------------|--------------------|--------|
| BackendContract  | N routes           | OK     |
| FrontendContract | N pages            | OK     |
| SharedContract   | N types Zod        | OK     |

Validation globale : OK | BLOCKED
```

7. Prochaine étape :
   - Si OK : "Contrats valides — lancer `/dtfs:generate-app <projectId>`."
   - Si BLOCKED : "Corriger les erreurs listées ci-dessus puis relancer."
