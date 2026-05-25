---
description: Décrit un écran ou une surface UI et crée le ScreenSpec correspondant (Phase 2).
---

Lance l'agent `dtfs-screen-spec-writer` sur la description d'écran fournie.
L'agent extrait les composants, les actions, les dataNeeds et l'acteur,
puis persiste via `dtfs__create_screen_spec`.

## Description

$ARGUMENTS

## Instructions

1. Identifier le projet cible et le `productSpecId` parent.
   Si non précisés, demander à l'utilisateur.
2. Lancer l'agent `dtfs-screen-spec-writer` avec la description ci-dessus.
3. Reporter le `screenSpecId` créé et le résultat de la validation.
