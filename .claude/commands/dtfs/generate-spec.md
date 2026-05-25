---
description: Génère les artefacts Spec Kit (constitution, spec, plan, tasks, …) pour une feature (Phase 4).
---

Lance l'agent `dtfs-sdd-writer` qui lit le ProductSpec + ScreenSpecs +
décisions Phase 3 et produit les Markdowns SDD, puis les valide.

## Cible

$ARGUMENTS

## Format attendu

`<projectId> <featureKey>` — `featureKey` au format `NNN-slug`
(ex. `001-billing`). Si absent, l'agent le demandera.

## Instructions

1. Vérifier que le clarification gate est ouvert (`dtfs__check_clarification_gate`).
   Si bloqué, demander à l'utilisateur de lancer `/dtfs:questions` d'abord.
2. Identifier le projet et le `featureKey`.
3. Lancer l'agent `dtfs-sdd-writer`.
4. Reporter les artefacts créés (kind + id) + la validation finale
   (`complete: true|false`).
