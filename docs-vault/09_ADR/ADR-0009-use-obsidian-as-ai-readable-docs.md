# ADR-0009 — Obsidian comme documentation lisible par l'IA

La documentation du projet DTFS est stockée dans un vault Obsidian (`docs-vault/`) avec une convention de liens `[[...]]` qui la rend navigable par les agents IA.

Liens : [[../00_Home/INDEX]] · [[ADR-0001-use-control-plane]].

## Source of truth

`/data/dev/design-to-fullstack/docs-vault/` — dossier racine du vault.

## AI usage

Les agents Claude Code lisent ce vault pour comprendre l'architecture, les règles de gouvernance et les contraintes du projet. Les liens `[[...]]` permettent la navigation inter-documents. Ce vault est lisible mais pas exécutable — la source de vérité exécutable reste le Control Plane (ADR-0001).

## Status

Accepted.

---

## Context

La documentation technique d'un système aussi complexe que DTFS (19 agents, 102 outils, 43 modèles Prisma) doit être :
1. Navigable par des humains (Obsidian graph view, backlinks).
2. Lisible par des agents IA sans préprocessing.
3. Structurée de façon cohérente (convention de format obligatoire).
4. Séparée des docs opérationnelles ad-hoc (`docs/`) qui sont des fichiers Markdown plats.

## Decision

Un vault Obsidian est créé dans `docs-vault/` avec la structure :
```
00_Home/       — Index, glossaire
01_Product/    — Vision, personas
02_Architecture/ — Vue d'ensemble, diagrammes
03_Control_Plane/ — Modèle de données, DSLs
04_Runtime_Contracts/ — Contrats compilés
05_Generated_App/ — Code généré, emitters
06_API/        — HTTP API, MCP tools
07_Schemas/    — Schémas Prisma, Zod
08_Diagrams/   — Diagrammes
09_ADR/        — Architecture Decision Records
10_Agents_MCP_Skills/ — Agents, hooks, règles
11_Testing/    — Stratégie de test
12_Operations/ — Dev local, Docker, migrations
```

Convention obligatoire par fichier :
- `# Titre` suivi d'un résumé ≤ 5 lignes
- Liens `[[...]]` vers les documents connexes
- `## Source of truth` — chemin du code de référence
- `## AI usage` — comment les agents utilisent ce document
- `## Status` — état du document

## Consequences

**Positif :**
- Navigation graph dans Obsidian pour les humains.
- Les agents peuvent suivre les liens `[[...]]` pour résoudre des dépendances.
- Format structuré = extraction d'information fiable.

**Négatif / Contrainte :**
- Maintenance : les docs doivent être mises à jour quand le code change.
- Les liens `[[...]]` ne sont pas validés automatiquement (aucun CI check).
- Les docs `docs/*.md` (flat) coexistent avec le vault — risque de désync.

## Alternatives considered

- **Notion** : pas d'API IA exploitable directement, format propriétaire.
- **Confluence** : idem, lourd opérationnellement.
- **README flat dans chaque dossier** : pas de navigation inter-documents, pas de backlinks.

## Related documents

- [[../00_Home/INDEX]]
- [[ADR-0001-use-control-plane]]
- [[../10_Agents_MCP_Skills/AGENTS_OVERVIEW]]
