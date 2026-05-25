---
description: Mappe les Requirements aux cibles Control Plane (Phase 5).
---

Lance l'agent `dtfs-platform-mapper` qui, pour chaque Requirement,
propose des `RequirementMapping` vers les Entity/Operation/Policy/Screen
existants.

## Cible

$ARGUMENTS

## Instructions

1. Identifier le projet courant + featureKey optionnel.
2. Lancer `dtfs-platform-mapper`.
3. Reporter coverage gate + OpenQuestions créés pour les cibles manquantes.
