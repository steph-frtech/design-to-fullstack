---
description: Synthétise une PlatformSpecProposal DRAFT à partir des Requirements et ScreenSpecs (Phase 6).
---

Lance l'agent `dtfs-platform-mapper` en mode proposition (Phase 6) via
`dtfs__propose_platform_spec`. Produit une proposition DRAFT que
l'utilisateur doit relire et accepter avant de passer à la Phase 7.

## Cible

$ARGUMENTS

## Instructions

1. Identifier le projet et le `featureKey` optionnel.
2. Vérifier que la coverage gate est ouverte
   (`dtfs__validate_requirement_coverage`). Si bloquée, demander à
   l'utilisateur de lancer `/dtfs:map-to-platform` d'abord.
3. Lancer l'agent `dtfs-platform-mapper` (étapes Phase 6 : propose + map_screens
   + enrich + validate_proposal).
4. Reporter :
   - `proposalId` + `status: DRAFT`
   - `confidenceScore`
   - top 3 openQuestions
   - nombre d'erreurs/warnings de validation
   - prochaine action : "Accepter avec `dtfs__accept_platform_proposal`, puis `/dtfs:validate` + `/dtfs:apply`."
