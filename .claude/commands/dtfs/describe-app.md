---
description: Décrit une app en langage naturel et crée le ProductSpec (Phase 1).
---

Lance l'agent `dtfs-product-analyst` sur la description fournie.
L'agent clarifie au besoin, extrait la ProductSpec, la persiste via
`dtfs__create_product_spec`, et la valide.

## Description

$ARGUMENTS

## Instructions

1. Identifier le projet cible. Si non précisé, appeler `dtfs__list_projects`
   et demander à l'utilisateur.
2. Lancer l'agent `dtfs-product-analyst` avec la description ci-dessus.
3. Reporter le `productSpecId` créé, le nombre de personas, d'openQuestions
   et d'assumptions, ainsi que le résultat de `dtfs__validate_product_spec`.
