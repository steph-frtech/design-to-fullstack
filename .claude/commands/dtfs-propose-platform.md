---
description: Synthétise une PlatformSpecProposal (read-only) pour une feature (Phase 6).
---

Lance l'agent `dtfs-platform-mapper` en mode proposition (Phase 6).
Lit le Control Plane + Requirements + ScreenSpecs et produit une
proposition `DRAFT` à relire avant application.

## Cible

$ARGUMENTS

## Instructions

1. Identifier le projet + le `featureKey` optionnel.
2. Lancer `dtfs-platform-mapper` (étapes mapping + synthèse proposal).
3. Reporter `proposalId` + confidenceScore + top warnings/questions.
