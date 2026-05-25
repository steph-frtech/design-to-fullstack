# Phase 4 — Spec Kit integration (SDD artifacts)

Phase 4 transforme l'intention produit (Phases 1-3) en **artefacts
Markdown** Spec-Driven Development. Ces documents sont lus par l'humain
et nourrissent les phases suivantes (mapping plateforme → DeltaSpec).

> Spec Kit formalise *le quoi et le pourquoi* (Markdown).
> Le Control Plane formalise *le comment générable* (JSON typé).

## Modèle

```prisma
model SpecArtifact {
  id             String   @id
  projectId      String
  kind           String   // constitution | spec | plan | tasks |
                          // research | data-model | quickstart |
                          // platform-mapping | contracts | notes
  featureKey     String?  // null pour artefacts projet-wide (constitution)
  path           String?  // chemin relatif quand synchronisé sur disque
  content        String   // Markdown brut
  contentHash    String   // SHA-256 pour détection de changement
  source         String   // generated | speckit | manual
  currentVersion Int
  createdAt      DateTime
  updatedAt      DateTime
}
```

## Convention Spec Kit (chemins disque)

```
.specify/memory/constitution.md             ← une par projet
specs/<featureKey>/spec.md
specs/<featureKey>/plan.md
specs/<featureKey>/tasks.md
specs/<featureKey>/research.md
specs/<featureKey>/data-model.md
specs/<featureKey>/quickstart.md
specs/<featureKey>/platform-mapping.md
specs/<featureKey>/contracts/               ← V1 placeholder, pas géré
```

`featureKey` suit la convention Spec Kit `NNN-slug` (ex. `001-billing`).

## Statuts de l'artefact

| `source`     | Sémantique                                                       |
|--------------|-------------------------------------------------------------------|
| `generated`  | Produit par l'agent `dtfs-sdd-writer`                             |
| `speckit`    | Produit par l'outil officiel Spec Kit (`uvx specify`)             |
| `manual`     | Écrit ou édité à la main par l'utilisateur                        |

## Validation

`validateSddArtifacts(projectId, featureKey?)` renvoie une checklist :

**Per-project** :
- `constitution` requis non vide

**Per-feature** :
- `spec`, `plan`, `tasks` requis non vides
- `research`, `data-model`, `quickstart`, `platform-mapping`, `contracts` optionnels

## Disk sync

Quand `project.localPath` est défini :

- `direction: "to-disk"` — la DB pousse chaque artefact dans le fichier
  correspondant (overwrite). Les répertoires sont créés au besoin.
- `direction: "from-disk"` — le backend lit chaque fichier attendu (et
  découvre les `featureKey` en explorant `specs/*/`), calcule le SHA-256,
  et upsert si le hash diffère. Source devient `manual`.

Quand `localPath` n'est pas défini, la sync est un no-op (`reason: "no_local_path"`).

Les chemins sont confinés à `PROJECTS_BASE_DIR` (`/data/dev`) via
`resolveSafe()` — pas de fuite hors du sandbox.

## API surface

### HTTP
```
GET    /api/projects/:id/sdd-artifacts?kind=&featureKey=
GET    /api/projects/:id/sdd-artifacts/:said
POST   /api/projects/:id/sdd-artifacts                 { kind, featureKey?, content, source?, path? }
PUT    /api/projects/:id/sdd-artifacts/:said           (patch)
DELETE /api/projects/:id/sdd-artifacts/:said
POST   /api/projects/:id/sdd-artifacts/generate        { featureKey?, source, artifacts: [{ kind, content }] }
POST   /api/projects/:id/sdd-artifacts/sync            { direction: "to-disk"|"from-disk", featureKey? }
POST   /api/projects/:id/sdd-artifacts/validate        { featureKey? }
```

`POST /generate` est un bulk upsert — l'agent fournit le contenu, le
backend persiste et calcule les hashes + chemins par défaut.

### MCP (5 tools)
```
dtfs__list_sdd_artifacts(projectId, kind?, featureKey?)
dtfs__read_sdd_artifact(projectId, kind, featureKey?)
dtfs__generate_sdd_artifacts(projectId, featureKey, source, artifacts)
dtfs__sync_speckit_artifacts(projectId, direction, featureKey?)
dtfs__validate_sdd_artifacts(projectId, featureKey?)
```

## Versioning

`SpecArtifact` est dans `VERSIONED_MODELS` ET dans
`MODELS_WITH_CURRENT_VERSION` (il a sa colonne `currentVersion`). Chaque
mutation produit une Revision liée au ChangeSet courant. Rollback fonctionne
au champ près.

## Agents

### `dtfs-sdd-writer`
Lit ProductSpec + ScreenSpecs + Assumptions/OpenQuestions Phase 3,
rédige les 4 artefacts requis (constitution + spec/plan/tasks) +
optionnels selon contexte, persiste via `generate_sdd_artifacts`, sync
to-disk si possible, valide.

Refuse si le clarification gate est encore `blocked`.

### `dtfs-sdd-reviewer`
Cross-check post-génération : couverture, cohérence glossaire/personas,
plan vs constitution, tasks vs ScreenSpec. Flag les gaps comme nouveaux
`OpenQuestion` (Phase 3).

## Slash commands

- `/dtfs:sdd-write <featureKey>` — lance le writer
- `/dtfs:sdd-review <featureKey>` — lance le reviewer

## Spec Kit officiel — relations

Spec Kit (CLI `uvx specify init`) génère une scaffold `.specify/` + des
slash-commands `/speckit.constitution`, `/speckit.specify`, `/speckit.plan`,
`/speckit.tasks`, `/speckit.implement`. V1 NE LANCE PAS ce CLI — nos
agents produisent les artefacts directement et la sync écrit aux chemins
attendus, donc Spec Kit peut être greffé dessus si l'utilisateur le veut.

`source: "speckit"` est réservé aux artefacts écrits par le CLI officiel,
permet de discriminer côté traçabilité.

## Exemple — feature `001-billing`

```bash
# Pré-requis : gate clair (Phase 3 fait son boulot)
/dtfs:clarify

# Génération
/dtfs:sdd-write 001-billing

# L'agent produit :
#   - constitution (si pas déjà là)
#   - specs/001-billing/spec.md
#   - specs/001-billing/plan.md
#   - specs/001-billing/tasks.md
#   - specs/001-billing/data-model.md   (optionnel, si Entity à introduire)
#
# Sync disk + validation auto. Rapport final.

# Review post-write
/dtfs:sdd-review 001-billing

# Si tout OK → ready-for-mapping (Phase 5).
```

## Hors scope Phase 4

- **`contracts/`** — directory de contrats OpenAPI/JSON Schema. V1 le
  laisse vide (Phase 9 codegen le remplira).
- **Watch mode** — pas de filesystem watcher. Sync explicite.
- **Merge bidirectionnel** — V1 fait des overwrites (to-disk = écrase
  les fichiers ; from-disk = upsert DB en gardant le dernier).
- **UI éditeur** — pas en V1.
- **Auto-renumber des featureKey** — l'utilisateur choisit, on n'auto-incrémente pas.

## Phase 4 → Phase 5

Une fois les artefacts SDD validés (`validate complete: true`), Phase 5
(Platform Mapping) lit `spec.md` + `tasks.md` + `data-model.md` +
`platform-mapping.md` et produit les `Requirement` + `RequirementMapping`
qui généreront le DeltaSpec final.
