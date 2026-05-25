---
description: Mappe les Requirements aux cibles Control Plane (Entity, Operation, Policy, …) (Phase 5).
---

Lance l'agent `dtfs-platform-mapper` qui, pour chaque Requirement ACCEPTED,
propose des `RequirementMapping` vers les cibles existantes du Control Plane.

## Cible

$ARGUMENTS

## Instructions

1. Identifier le projet courant et le `featureKey` optionnel.
2. Lancer l'agent `dtfs-platform-mapper` (phase mapping uniquement — étapes 1 à 5).
3. Reporter :
   - coverage gate (`blocked: true|false`)
   - nombre de mappings créés par `targetType`
   - OpenQuestions créés pour les cibles manquantes
