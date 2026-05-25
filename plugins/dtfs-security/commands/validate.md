---
description: Valide un DeltaSpec, une operation, une policy rule ou une expression (read-only).
---

Lance l'agent `dtfs-spec-validator` sur l'artefact ciblé. Rapporte chaque
erreur et warning avec un chemin exact et une suggestion de correction.
Ne modifie rien.

## Cible

$ARGUMENTS

## Format attendu

L'un des formats suivants :
- `<projectId>` — valide le spec complet du projet
- `delta:<deltaSpecId>` — valide un DeltaSpec précis
- `op:<operationId>` — valide le body d'une opération
- `policy:<policyRuleId>` — valide une policy rule
- `expr:<expression>` — valide une expression DSL inline
- `proposal:<proposalId>` — valide une PlatformSpecProposal

## Instructions

1. Parser `$ARGUMENTS` pour identifier le scope.
2. Lancer l'agent `dtfs-spec-validator` sur le scope identifié.
3. Présenter le tableau de synthèse (error / warning / info) et le verdict
   final : `VALID`, `WARNINGS`, ou `BLOCKED`.
