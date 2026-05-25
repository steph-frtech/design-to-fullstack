---
description: Génère les artefacts Spec Kit (constitution + spec/plan/tasks/…) pour une feature (Phase 4).
---

Lance l'agent `dtfs-sdd-writer` qui lit le ProductSpec + ScreenSpecs +
décisions Phase 3 et produit les Markdowns SDD.

## Cible

$ARGUMENTS

## Format attendu

`<featureKey>` au format `NNN-slug` (ex. `001-billing`, `002-dashboard`).
Si absent, l'agent te le demandera.

## Instructions

1. Identifier le projet courant.
2. Lancer `dtfs-sdd-writer` avec le `featureKey`.
3. Reporter les artefacts créés + la validation finale.
