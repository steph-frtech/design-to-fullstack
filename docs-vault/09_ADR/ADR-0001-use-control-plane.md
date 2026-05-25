# ADR-0001 — Control Plane = source de vérité exécutable

Le Control Plane est la base de données Prisma qui stocke l'intégralité du modèle d'une application (entités, opérations, écrans, politiques, etc.) de façon structurée et requêtable — pas du Markdown libre, pas du JSON dans un fichier.

Liens : [[../03_Control_Plane/CONTROL_PLANE_OVERVIEW]] · [[ADR-0002-use-deltaspec]] · [[ADR-0004-separate-control-plane-and-client-runtime]].

## Source of truth

`backend/prisma/schema.prisma` (43 modèles, 14 migrations appliquées).

## AI usage

Les agents lisent le Control Plane via les outils MCP (`dtfs__get_project_spec`, etc.) et le modifient exclusivement via DeltaSpec + ChangeSet. Jamais de modification directe en base.

## Status

Accepted.

---

## Context

Les approches précédentes (Markdown + YAML, JSON libre dans des fichiers) rendaient impossible la validation automatique, la traçabilité des changements et la génération de code deterministe. Un LLM ne peut pas garantir la cohérence d'un modèle éparpillé dans des fichiers texte.

Le projet a besoin d'un registre central requêtable, versionné et validable programmatiquement, qui serve à la fois de mémoire de l'application et d'entrée pour le codegen.

## Decision

Toute connaissance sur une application en cours de conception est stockée dans une base PostgreSQL pilotée par Prisma. Le schéma couvre 43 modèles organisés en couches : Product (ProductSpec, ScreenSpec), Data Model (Entity, Attribute, Relation, Resource, Operation, Policy), UI (Screen, Component, Form, Field, Action, DataBinding), Infra (AuthMethod, Asset, Integration, Trigger, Workflow, EventDefinition), Tests (TestScenario), Orchestration (ChangeSet, Revision, AuditLog), Contracts (RuntimeTarget, BackendContract, FrontendContract, SharedContract).

Ce registre est appelé "Control Plane". Il est distinct de la base de données de l'application générée.

## Consequences

**Positif :**
- Validation croisée possible (une opération peut référencer uniquement des entités existantes).
- Génération de code déterministe et reproductible.
- Diff/revert possibles sur toute modification.
- Les 102 outils MCP peuvent exposer le modèle à n'importe quel agent IA.

**Négatif / Contrainte :**
- Tout changement de schéma nécessite une migration Prisma (gate manuel recommandé).
- Les buckets non implémentés dans `applyDeltaSpec` retournent `not_implemented_yet` jusqu'à leur complétion.

## Alternatives considered

- **YAML/JSON flat files** : simple à écrire, impossible à valider de façon programmatique, pas de requêtes relationnelles, pas de revert atomique.
- **GraphQL registry** : surcharge opérationnelle, pas adapté à un système mono-tenant de design-time.
- **Notion/Confluence** : pas d'API exploitable par l'IA, pas de validation.

## Related documents

- [[ADR-0002-use-deltaspec]]
- [[ADR-0003-use-changesets]]
- [[../03_Control_Plane/CONTROL_PLANE_OVERVIEW]]
- [[../07_Schemas/PRISMA_SCHEMA]]
