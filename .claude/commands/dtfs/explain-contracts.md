---
description: "Explique en langage naturel les contrats compilés d'un projet (BackendContract, FrontendContract, SharedContract). Phase 26."
---

Appelle `dtfs__explain_contracts` et présente une explication lisible des
trois contrats compilés : routes, pages, types partagés, et cohérence
inter-contrats.

## Cible

$ARGUMENTS

## Format attendu

`<projectId>`

## Instructions

1. Identifier le `projectId` depuis `$ARGUMENTS`. Si absent, demander.

2. Appeler `dtfs__explain_contracts(projectId)`.
   - Si l'appel échoue avec "contracts not compiled", indiquer :
     "Les contrats ne sont pas encore compilés — lancer
     `/dtfs:compile-contracts <projectId>` d'abord."

3. Afficher l'explication retournée par le tool (markdown) telle quelle,
   puis ajouter un résumé en 3 bullet points :
   - Ce que l'API backend expose.
   - Ce que le frontend consomme.
   - Ce que le SDK partagé exporte.

4. Si des incohérences sont détectées dans l'explication (warnings), les
   lister séparément sous "⚠ Points d'attention".

5. Prochaine étape : "Pour valider formellement : `/dtfs:compile-contracts`
   avec validation. Pour générer : `/dtfs:generate-app`."
