---
description: Résout les OpenQuestion et Assumption ouvertes d'un projet (Phase 3).
---

Lance l'agent `dtfs-question-manager` pour dialoguer avec l'utilisateur
et résoudre les items OPEN avant de passer à la phase suivante.

## Cible

$ARGUMENTS

## Instructions

1. Identifier le projet cible. Si non précisé dans `$ARGUMENTS`, demander.
2. Appeler `dtfs__check_clarification_gate(projectId)` pour vérifier s'il
   reste des items à résoudre.
3. Lancer l'agent `dtfs-question-manager`.
4. Reporter l'état du clarification gate après le dialogue :
   `blocked: true|false` + items restants éventuels.
