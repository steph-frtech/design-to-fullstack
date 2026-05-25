---
description: "Affiche l'état complet d'un projet : gates, derniers ChangeSets, proposals en cours."
---

Agrège l'état du projet via plusieurs appels MCP read-only et présente un
tableau de bord en markdown.

## Cible

$ARGUMENTS

## Instructions

1. Identifier le `projectId` depuis `$ARGUMENTS` ou depuis le contexte de
   session. Si absent, appeler `dtfs__list_projects` et demander.
2. Appeler en parallèle :
   - `dtfs__check_clarification_gate(projectId)` — gate clarification
   - `dtfs__validate_requirement_coverage(projectId)` — gate coverage
   - `dtfs__list_platform_proposals(projectId)` — proposals DRAFT / ACCEPTED
   - `dtfs__list_history(projectId)` — 5 derniers ChangeSets
3. Afficher un tableau de bord :

```
## Statut du projet <projectId>

### Gates
| Gate              | Statut  | Bloquants            |
|-------------------|---------|----------------------|
| Clarification     | OK / ⛔ | <items si bloqué>    |
| Coverage          | OK / ⛔ | <requirements>       |

### Proposals actives
| proposalId | status | confidence | feature |
|------------|--------|------------|---------|
| ...        | ...    | ...        | ...     |

### Derniers ChangeSets
| changeSetId | date | message | status |
|-------------|------|---------|--------|
| ...         | ...  | ...     | ...    |
```

4. Conclure avec la **prochaine action recommandée** selon l'état (ex. :
   "Gate clarification bloqué → `/dtfs:questions`", "Proposal DRAFT prête
   → accepter puis `/dtfs:validate`", "Tout vert → `/dtfs:apply`").
