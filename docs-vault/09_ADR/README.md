# Architecture Decision Records (ADR)

Un ADR documente une décision architecturale significative prise dans le projet : le contexte qui l'a motivée, la décision elle-même, ses conséquences et les alternatives rejetées. Ce dossier est la source de vérité pour comprendre *pourquoi* le système est conçu comme il l'est.

Format obligatoire : `# ADR-XXXX — Title` / `## Status` / `## Context` / `## Decision` / `## Consequences` / `## Alternatives considered` / `## Related documents`.

Statuts possibles : **Accepted** (en vigueur), **Proposed** (en discussion), **Deprecated** (remplacé).

Les ADR sont immuables une fois Accepted : si une décision change, on crée un nouvel ADR qui supersede l'ancien.

Liens vers l'architecture globale : [[../02_Architecture/ARCHITECTURE_OVERVIEW]] · [[../03_Control_Plane/CONTROL_PLANE_OVERVIEW]].

## Source of truth

Ce dossier. Les ADR NE sont PAS dans `docs/` ; ils sont ici.

## AI usage

Les agents DTFS lisent les ADR pour comprendre les contraintes immuables du système. Un agent ne doit jamais proposer une solution qui contredit un ADR Accepted sans en créer un nouveau.

## Status

10 ADR actifs — tous Accepted sauf mention contraire.

---

## Index

| ID | Titre | Status |
|----|-------|--------|
| [[ADR-0001-use-control-plane]] | Control Plane = source de vérité exécutable | Accepted |
| [[ADR-0002-use-deltaspec]] | Toute modification passe par DeltaSpec | Accepted |
| [[ADR-0003-use-changesets]] | Modifications traçables et réversibles via ChangeSet | Accepted |
| [[ADR-0004-separate-control-plane-and-client-runtime]] | Séparer l'usine DTFS et les apps générées | Accepted |
| [[ADR-0005-use-hono-for-generated-api]] | Hono 4 pour l'API des apps générées | Accepted |
| [[ADR-0006-use-better-auth]] | Better Auth pour l'authentification | Accepted |
| [[ADR-0007-use-next16]] | Next.js 16 App Router pour le frontend généré | Accepted |
| [[ADR-0008-use-contract-compilation-before-codegen]] | Compiler les contrats avant la génération de code | Accepted |
| [[ADR-0009-use-obsidian-as-ai-readable-docs]] | Obsidian comme docs lisibles par l'IA | Accepted |
| [[ADR-0010-use-openapi-jsonschema-zod]] | OpenAPI / JSON Schema / Zod comme couche de contrat | Accepted |
