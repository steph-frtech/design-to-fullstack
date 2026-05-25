---
description: Extrait des Requirements traçables depuis les artefacts SDD d'une feature (Phase 5).
---

Lance l'agent `dtfs-requirement-extractor` qui lit `spec.md` + `tasks.md`
+ `constitution.md` et produit les `Requirement` rows (REQ-NNN typés).

## Cible

$ARGUMENTS

## Format attendu

`<featureKey>` (ex. `001-billing`). Si absent, l'agent demande.

## Instructions

1. Identifier le projet courant.
2. Lancer `dtfs-requirement-extractor` avec le `featureKey`.
3. Reporter le nombre de Requirements + breakdown par priorité.
