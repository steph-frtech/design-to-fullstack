# Skills and Commands

Les 20 slash commands `/dtfs:*` du namespace DTFS, plus les commandes legacy flat. Ce fichier documente l'ordre d'invocation de `/dtfs:generate-app` (pipeline complet).

Liens : [[AGENTS_OVERVIEW]] · [[HOOKS]] · [[../09_ADR/ADR-0008-use-contract-compilation-before-codegen]].

## Source of truth

`.claude/commands/dtfs/*.md` — 20 commandes dans le namespace `/dtfs:`. `.claude/commands/dtfs-*.md` — 8 commandes legacy flat préservées.

## AI usage

Les slash commands sont des points d'entrée standardisés pour les utilisateurs. Chaque commande invoque un ou plusieurs agents. Les arguments sont passés via `$ARGUMENTS`.

## Status

20/20 commandes actives. 8 commandes legacy flat coexistent (dedup backlog P2).

---

## Pipeline commands (en ordre)

| Commande | Phase | Agent invoqué | Action |
|----------|-------|---------------|--------|
| `/dtfs:describe-app` | 1 | `dtfs-product-analyst` | Capturer un `ProductSpec` depuis la description |
| `/dtfs:describe-screen` | 2 | `dtfs-screen-spec-writer` | Capturer un `ScreenSpec` depuis une description d'écran |
| `/dtfs:questions` | 3 | `dtfs-question-manager` | Résoudre les questions et assumptions OPEN |
| `/dtfs:generate-spec` | 4 | `dtfs-sdd-writer` | Produire les artefacts SDD pour une feature |
| `/dtfs:map-to-platform` | 5 | `dtfs-platform-mapper` (mapping pass) | Créer les RequirementMapping rows |
| `/dtfs:propose` | 6 | `dtfs-platform-mapper` (proposal synthesis) | Créer un `PlatformSpecProposal` DRAFT |
| `/dtfs:validate` | 6–7 | `dtfs-spec-validator` | Valider tout artefact (delta, op, policy, expr) |
| `/dtfs:apply` | 7 | — (direct MCP) | `begin_changeset` → `apply_delta_spec` → `commit_changeset` |
| `/dtfs:revert` | any | — (direct MCP) | `dtfs__revert_changeset` ou `dtfs__revert_field` |
| `/dtfs:status` | any | — (direct MCP) | Dashboard gates + proposals + ChangeSets récents |

### Runtime & Codegen commands

| Commande | Phase | Agent invoqué | Action |
|----------|-------|---------------|--------|
| `/dtfs:set-runtime` | 26 | `dtfs-runtime-architect` | Configurer le `RuntimeTarget` |
| `/dtfs:compile-contracts` | 26 | compilateurs individuels | Compiler les 3 contrats (shared→backend→frontend) + validate + explain |
| `/dtfs:explain-contracts` | 26 | — | Appeler `dtfs__explain_contracts` et afficher |
| `/dtfs:generate-backend` | 26+ | `dtfs-hono-api-generator` | Générer les routes Hono (dry-run par défaut) |
| `/dtfs:generate-auth` | 26+ | `dtfs-better-auth-generator` | Générer `auth.ts` (dry-run par défaut) |
| `/dtfs:generate-frontend` | 26+ | `dtfs-next16-generator` | Générer les pages Next.js (dry-run par défaut) |
| `/dtfs:generate-sdk` | 26+ | `dtfs-sdk-generator` | Générer le package SDK (dry-run par défaut) |
| `/dtfs:generate-app` | 26 | `dtfs-codegen-orchestrator` | **Pipeline complet** contracts → generate_app |
| `/dtfs:check-generated` | 26 | `dtfs-generated-code-reviewer` | Auditer la structure, TypeScript, protections |
| `/dtfs:run-generated-tests` | 26+ | — | Lancer vitest/jest dans le répertoire de sortie |

---

## Ordre détaillé de `/dtfs:generate-app`

```
/dtfs:generate-app <projectId>
        |
        v
dtfs-codegen-orchestrator
        |
        ├── dtfs__get_project_spec         [pre-flight — abort si vide]
        ├── dtfs__get_runtime_target       [pre-flight — abort si absent]
        |
        ├── dtfs__compile_shared_contract  [types partagés en premier]
        ├── dtfs__compile_backend_contract [routes + auth]
        ├── dtfs__compile_frontend_contract[pages + bindings]
        ├── dtfs__validate_contracts       [cohérence — bloque si invalide]
        ├── dtfs__explain_contracts        [résumé lisible]
        |
        ├── dtfs__generate_app(dryRun=true) [plan : N fichiers, N lignes]
        ├── [confirmation utilisateur]
        └── dtfs__generate_app(dryRun=false)[écriture → outDir]
                |
                v
        /dtfs:check-generated <projectId> --out <dir>
                |
                v
        /dtfs:run-generated-tests <projectId> --out <dir>
```

Note : l'ordre de compilation est `shared → backend → frontend` (le SharedContract ne dépend de rien, le BackendContract dépend du SharedContract).

---

## Commandes legacy flat (préservées)

Stockées dans `.claude/commands/` (pas dans `dtfs/`). Coexistent avec les commandes `/dtfs:*`.

| Commande | Équivalent pipeline |
|----------|---------------------|
| `dtfs-clarify` | `/dtfs:questions` |
| `dtfs-extract-requirements` | invoque `dtfs-requirement-extractor` |
| `dtfs-map-platform` | `/dtfs:map-to-platform` |
| `dtfs-product-spec` | `/dtfs:describe-app` |
| `dtfs-propose-platform` | `/dtfs:propose` |
| `dtfs-screen-spec` | `/dtfs:describe-screen` |
| `dtfs-sdd-review` | invoque `dtfs-sdd-reviewer` |
| `dtfs-sdd-write` | `/dtfs:generate-spec` |

Backlog P2 : dédupliquer flat vs `dtfs/`.
