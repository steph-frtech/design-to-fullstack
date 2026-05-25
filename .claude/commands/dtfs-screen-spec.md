---
description: Capture l'intention fonctionnelle d'un écran dans un ScreenSpec (Phase 2).
---

Lance l'agent `dtfs-screen-spec-writer` sur la description fournie.
L'agent identifie le projet + le ProductSpec courant, clarifie si besoin,
extrait l'intention fonctionnelle (acteur, objectif, composants, données,
actions, états), persiste via MCP et valide.

## Description de l'écran

$ARGUMENTS

## Instructions

1. Identifier le projet cible. Si pas en contexte, demander à l'utilisateur
   ou lister via `dtfs__list_projects`.
2. Récupérer le ProductSpec via `dtfs__list_product_specs` + `dtfs__get_product_spec`.
3. Lire les éventuels fichiers HTML/MD fournis avec l'outil `Read`.
4. Lancer l'agent `dtfs-screen-spec-writer`.
5. Reporter `screenSpecId` + résultat de la validation.
