# ProjectSpec

`ProjectSpec` est la vue agrégée **nested** de l'état complet d'un projet — toutes ses définitions Control Plane rassemblées dans un seul document JSON ou Markdown. C'est la snapshot que les LLMs et les agents lisent avant de produire un DeltaSpec ou de lancer le codegen.

**Liens** : [[CONTROL_PLANE_MODEL]] · [[DELTA_SPEC]] · [[CHANGESET_REVISION]]

## Source of truth

`backend/src/projects.ts` (endpoint `GET /api/projects/:id/spec`) · `backend/src/mcp.ts` (tool `dtfs__get_project_spec`) · `docs/BACKEND_MODEL.md`

## AI usage

Toujours appeler `dtfs__get_project_spec(projectId, "md")` en début de tâche pour charger l'état courant. Ne jamais supposer l'état du projet sans cette lecture. Le format `md` est compact et tient dans une fenêtre de contexte pour les petits projets.

## Status

V1 — disponible. `getSpecAt` couvre seulement Entity/Attribute/Operation en V1 (Relations/Resources/Policies/Screens vides dans les snapshots historiques).

---

## Ce que ProjectSpec contient

Un ProjectSpec est une vue **read-only** : il ne peut pas être écrit directement. Toute modification passe par DeltaSpec → ChangeSet.

```jsonc
{
  "project": {
    "id": "...",
    "slug": "todo-multi-user",
    "enabledScreenTypes": ["web"],
    "defaultLocale": { "code": "en", "name": "English" }
  },

  // Layer 1-2 — Compréhension produit
  "productSpecs": [ /* ProductSpec[] */ ],
  "screenSpecs":  [ /* ScreenSpec[] */ ],
  "requirements": [ /* Requirement[] */ ],

  // Layer 3 — Clarification
  "openQuestions": [ /* OpenQuestion[] */ ],
  "assumptions":   [ /* Assumption[] */ ],

  // Layer 4 — Spec Kit
  "specArtifacts": [ /* SpecArtifact[] */ ],

  // Layer 6 — Modèle de données
  "entities": [
    {
      "id": "...",
      "name": "TodoList",
      "attributes": [
        { "name": "title", "type": "TEXT", "required": true }
      ]
    }
  ],
  "relations": [ /* EntityRelation[] */ ],

  // Layer 7 — Exposition API
  "resources":     [ /* Resource[] */ ],
  "operations":    [ /* Operation[] (steps inclus) */ ],
  "policies":      [ /* Policy[] (rule incluse) */ ],
  "integrations":  [ /* Integration[] */ ],
  "triggers":      [ /* Trigger[] */ ],
  "behaviors":     [ /* Behavior[] */ ],
  "workflows":     [ /* Workflow[] */ ],

  // Layer 8 — Sécurité
  "authMethods":      [ /* AuthMethod[] */ ],
  "secrets":          [ /* Secret[] — vault ref seulement, jamais la valeur */ ],
  "environments":     [ /* Environment[] */ ],
  "appRoles":         [ /* AppRole[] */ ],
  "eventDefinitions": [ /* EventDefinition[] */ ],

  // Layer 5 — UI
  "screens":       [ /* Screen[] (avec components inclus) */ ],
  "actions":       [ /* Action[] */ ],
  "dataBindings":  [ /* DataBinding[] */ ],

  // Layer 9 — Codegen
  "assets":              [ /* Asset[] */ ],
  "generatedArtifacts":  [ /* GeneratedArtifact[] */ ],
  "deploymentTargets":   [ /* DeploymentTarget[] */ ],
  "runtimeTargets":      [ /* RuntimeTarget[] */ ],
  "testScenarios":       [ /* TestScenario[] */ ],

  // Audit
  "auditLogs": [ /* AuditLog[] (derniers N) */ ]
}
```

---

## Comment l'obtenir

### Via HTTP

```bash
# JSON (complet)
GET /api/projects/:id/spec

# Markdown compact (LLM-friendly)
GET /api/projects/:id/spec.md
```

Le format Markdown produit un document structuré par section, compact, sans perte pour les informations concept-level pertinentes pour le codegen.

### Via MCP

```
dtfs__get_project_spec(projectId: string, format: "json" | "md")
```

### Via lecture directe (agents)

Les agents Claude Code utilisent systématiquement l'outil MCP `dtfs__get_project_spec` avec `format: "md"` — c'est le point d'entrée canonique.

---

## Snapshot historique : getSpecAt

Pour obtenir l'état du projet **à un instant donné** (après un ChangeSet spécifique) :

```bash
GET /api/projects/:projectId/changesets/:csId/spec-at

# Ou par numéro de version
GET /api/projects/:projectId/changesets/spec-at?version=5
GET /api/projects/:projectId/changesets/spec-at?version=latest
```

**Limite V1** : `getSpecAt` reconstruit seulement Entity + Attribute + Operation. Relations, Resources, Policies, Screens sont des tableaux vides dans les snapshots historiques.

---

## Format Markdown (spec.md)

Le document Markdown est organisé par sections :

```
# Project: <slug>

## Entities
| Name | Attributes |
| ... | ... |

## Operations
### createTodoList (COMMAND)
Input: ...
Steps: ...

## Policies
### authenticated-only (OPERATION)
Rule: exists($.auth.userId)

## Screens
### /todo-lists (web)
Components: ...

...
```

Ce format est conçu pour tenir dans une fenêtre de contexte LLM pour les projets de taille raisonnable (< 50 entités, < 100 opérations).

---

## Relation au DeltaSpec

`ProjectSpec` est l'état courant. `DeltaSpec` est un diff à appliquer. Le flux est :

```
1. Lire ProjectSpec (état courant)
2. Analyser → proposer un DeltaSpec
3. Valider le DeltaSpec (dtfs__validate_delta_spec)
4. Appliquer → nouveau ProjectSpec
```

Le ProjectSpec ne contient jamais de DeltaSpec en cours — c'est une vue snapshotée de la base après apply.
