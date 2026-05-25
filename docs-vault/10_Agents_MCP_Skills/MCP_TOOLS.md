# MCP Tools

Les 102 outils MCP exposés par `createMcpServer()` dans `backend/src/mcp.ts`. Groupés par catégorie. **L** = lecture seule, **M** = mutation.

Source originale : `docs/MCP_TOOLS.md`. Ce fichier est la version vault avec catégorisation et marquage lecture/mutation.

Liens : [[AGENTS_OVERVIEW]] · [[../06_API/HTTP_API]] · [[../09_ADR/ADR-0002-use-deltaspec]].

## Source of truth

`backend/src/mcp.ts` — registre canonique des tools. Vérifier avec `grep -oP '"dtfs__[a-z_]+"' backend/src/mcp.ts | sort -u`.

## AI usage

Les agents n'utilisent que les outils listés dans leur définition (`.claude/agents/dtfs-*.md`). Jamais d'appel direct à Prisma ou à l'API HTTP depuis un agent.

## Status

102 tools enregistrés (Phase 29). 21 MVP marqués ✓.

---

## Core — Spec & Introspection (L)

| Tool | MVP | Description |
|------|-----|-------------|
| `dtfs__list_projects` | ✓ | Liste les projets |
| `dtfs__get_project_spec` | ✓ | Spec complète JSON ou Markdown |
| `dtfs__describe_concept` | ✓ | Documentation d'un concept DTFS |
| `dtfs__list_expr_functions` | ✓ | Catalogue des 8 fonctions Expr autorisées |
| `dtfs__list_behaviors` | ✓ | Catalogue des behaviors |
| `dtfs__expand_behaviors` | | Aperçu d'expansion des behaviors |
| `dtfs__validate_spec` | ✓ | Valider un DeltaSpec |

---

## Natural Spec — ProductSpec (Phase 1)

| Tool | MVP | Mode | Description |
|------|-----|------|-------------|
| `dtfs__list_product_specs` | | L | Lister les ProductSpec |
| `dtfs__get_product_spec` | | L | Lire un ProductSpec |
| `dtfs__create_product_spec` | | M | Créer un ProductSpec |
| `dtfs__create_product_spec_from_prompt` | ✓ | M | Alias → create (depuis prompt) |
| `dtfs__update_product_spec` | | M | Mettre à jour un ProductSpec |
| `dtfs__validate_product_spec` | | L | Valider un ProductSpec |

---

## Natural Spec — ScreenSpec (Phase 2)

| Tool | MVP | Mode | Description |
|------|-----|------|-------------|
| `dtfs__list_screen_specs` | | L | Lister les ScreenSpec |
| `dtfs__get_screen_spec` | | L | Lire un ScreenSpec |
| `dtfs__create_screen_spec` | | M | Créer un ScreenSpec |
| `dtfs__create_screen_spec_from_prompt` | ✓ | M | Alias → create |
| `dtfs__update_screen_spec` | | M | Mettre à jour un ScreenSpec |
| `dtfs__validate_screen_spec` | | L | Valider un ScreenSpec |

---

## Natural Spec — Clarification (Phase 3)

| Tool | MVP | Mode | Description |
|------|-----|------|-------------|
| `dtfs__list_open_questions` | ✓ | L | Lister les OpenQuestion |
| `dtfs__create_open_question` | | M | Créer une OpenQuestion |
| `dtfs__answer_open_question` | ✓ | M | Répondre à une question |
| `dtfs__defer_open_question` | | M | Déférer une question |
| `dtfs__list_assumptions` | | L | Lister les Assumption |
| `dtfs__create_assumption` | | M | Créer une Assumption |
| `dtfs__accept_assumption` | | M | Accepter une Assumption |
| `dtfs__reject_assumption` | | M | Rejeter une Assumption |
| `dtfs__check_clarification_gate` | | L | Vérifier si le gate de clarification est bloquant |

---

## Spec Kit — SDD Artifacts (Phase 4)

| Tool | MVP | Mode | Description |
|------|-----|------|-------------|
| `dtfs__list_sdd_artifacts` | | L | Lister les SpecArtifact |
| `dtfs__read_sdd_artifact` | | L | Lire un artefact SDD |
| `dtfs__generate_sdd_artifacts` | ✓ | M | Générer/upsert des artefacts SDD |
| `dtfs__sync_speckit_artifacts` | ✓ | M | Sync DB ↔ disque bidirectionnel |
| `dtfs__validate_sdd_artifacts` | ✓ | L | Valider la présence des artefacts requis |

---

## Requirements + Platform Mapping (Phase 5)

| Tool | MVP | Mode | Description |
|------|-----|------|-------------|
| `dtfs__list_requirements` | | L | Lister les Requirements |
| `dtfs__get_requirement` | | L | Lire un Requirement |
| `dtfs__extract_requirements` | | M | Extraire des Requirements depuis SDD |
| `dtfs__accept_requirement` | | M | Accepter un Requirement |
| `dtfs__reject_requirement` | | M | Rejeter un Requirement |
| `dtfs__map_requirements_to_platform` | | M | Mapper Requirements → targets |
| `dtfs__list_requirement_mappings` | | L | Lister les RequirementMapping |
| `dtfs__validate_requirement_coverage` | | L | Vérifier la couverture des Requirements |

---

## PlatformSpec Proposal (Phase 6)

| Tool | MVP | Mode | Description |
|------|-----|------|-------------|
| `dtfs__propose_platform_spec` | ✓ | M | Créer un squelette de PlatformSpecProposal |
| `dtfs__map_screens_to_platform` | | M | Suggérer Screen/Component depuis ScreenSpec |
| `dtfs__list_platform_proposals` | | L | Lister les proposals |
| `dtfs__get_platform_proposal` | | L | Lire un proposal |
| `dtfs__accept_platform_proposal` | | M | Accepter un proposal |
| `dtfs__reject_platform_proposal` | | M | Rejeter un proposal |
| `dtfs__validate_platform_proposal` | | L | Valider statiquement un proposal |

---

## DeltaSpec (Phase 7)

| Tool | MVP | Mode | Description |
|------|-----|------|-------------|
| `dtfs__create_delta_from_platform_proposal` | ✓ | L* | Compiler Proposal → DeltaSpec (pas d'apply) |
| `dtfs__validate_delta_spec` | | L | Valider un DeltaSpec |
| `dtfs__explain_delta_spec` | ✓ | L | Expliquer un DeltaSpec en markdown |

*Crée un objet en mémoire/retourne un JSON, ne mute pas le Control Plane.

---

## ChangeSet (Tracabilité & Revert)

| Tool | MVP | Mode | Description |
|------|-----|------|-------------|
| `dtfs__begin_changeset` | ✓ | M | Ouvrir un ChangeSet |
| `dtfs__commit_changeset` | ✓ | M | Committer un ChangeSet |
| `dtfs__discard_changeset` | ✓ | M | Abandonner un ChangeSet OPEN |
| `dtfs__revert_changeset` | ✓ | M | Créer un ChangeSet REVERTED inverse |
| `dtfs__apply_delta_spec` | | M | Appliquer un DeltaSpec (alias: apply_spec) |
| `dtfs__apply_spec` | ✓ | M | Appliquer un DeltaSpec (alias principal) |
| `dtfs__get_spec_at` | | L | Snapshot du spec à une version donnée |
| `dtfs__diff_changesets` | | L | Diff entre deux ChangeSets |
| `dtfs__list_history` | | L | Historique des ChangeSets |
| `dtfs__describe_changeset` | | L | Détail d'un ChangeSet + Revisions |
| `dtfs__revert_revision` | | M | Annuler une Revision individuelle |
| `dtfs__revert_field` | | M | Annuler un champ d'une Revision |

---

## Expr / Operation / Policy DSL

| Tool | MVP | Mode | Description |
|------|-----|------|-------------|
| `dtfs__list_expr_functions` | ✓ | L | Catalogue des 8 fonctions |
| `dtfs__validate_expr` | | L | Valider une expression Expr |
| `dtfs__eval_expr` | | L | Évaluer une expression |
| `dtfs__analyze_expr` | | L | Analyser refs/calls/type d'une expr |
| `dtfs__list_operation_step_kinds` | | L | Catalogue des 10 step kinds |
| `dtfs__validate_operation_body` | | L | Valider un body d'opération |
| `dtfs__analyze_operation_body` | | L | Analyser entities/policies/integrations |
| `dtfs__validate_policy_rule` | | L | Valider une PolicyRule |
| `dtfs__list_policy_rule_ops` | | L | Catalogue des 12 opérateurs |
| `dtfs__eval_policy_rule` | | L | Évaluer une rule |

---

## HTML / Figma Import (Phase 14)

| Tool | Mode | Description |
|------|------|-------------|
| `dtfs__analyze_html` | L | Analyser la structure d'un HTML |
| `dtfs__diff_html` | L | Diff HTML vs ScreenSpec existant |
| `dtfs__import_html_proposal` | M | Créer un PlatformSpecProposal DRAFT depuis HTML |
| `dtfs__analyze_figma` | L | Analyser un JSON Figma ou fileKey |
| `dtfs__import_design_proposal` | M | Créer un Proposal DRAFT depuis Figma |

---

## Runtime / Contracts (Phase 26)

| Tool | Mode | Description |
|------|------|-------------|
| `dtfs__get_runtime_target` | L | Lire le RuntimeTarget |
| `dtfs__set_runtime_target` | M | Persister le RuntimeTarget |
| `dtfs__compile_backend_contract` | M | Compiler le BackendContract |
| `dtfs__compile_frontend_contract` | M | Compiler le FrontendContract |
| `dtfs__compile_shared_contract` | M | Compiler le SharedContract |
| `dtfs__validate_contracts` | L | Valider la cohérence des 3 contrats |
| `dtfs__explain_contracts` | L | Expliquer les contrats en markdown |

---

## Codegen (Phases 27–28)

| Tool | Mode | Description |
|------|------|-------------|
| `dtfs__generate_app` | M | Générer l'app complète (dry-run ou write) |
| `dtfs__preview_generated_file` | L | Aperçu d'un fichier généré en mémoire |
| `dtfs__plan_codegen` | L | Plan ordonné de génération par couche |
| `dtfs__generate_database_schema` | M | Générer `prisma/schema.prisma` |
| `dtfs__generate_auth_runtime` | M | Générer `auth.ts` |
| `dtfs__generate_backend_api` | M | Générer les routes Hono |
| `dtfs__generate_frontend_next` | M | Générer les pages Next.js |
| `dtfs__generate_shared_sdk` | M | Générer `packages/shared/` |
| `dtfs__generate_tests` | M | Générer les fichiers de test |
| `dtfs__check_generated_project` | L | Vérifier la structure du projet généré |
| `dtfs__typecheck_generated_project` | L | `tsc --noEmit` sur le projet généré |
| `dtfs__run_generated_tests` | L* | Lancer les tests générés (stub actuellement) |
| `dtfs__diff_generated_artifacts` | L | Diff artifacts entre deux ChangeSets |

*`run_generated_tests` retourne toujours `skipped: true` (stub V1).

---

## Governance & Audit

| Tool | Mode | Description |
|------|------|-------------|
| `dtfs__run_governance_checks` | L | Lancer les 7 guardrails avant apply |
| `dtfs__read_audit_log` | L | Lire le log d'audit (JSONL) |

---

## Behaviors

| Tool | Mode | Description |
|------|------|-------------|
| `dtfs__expand_behaviors_to_delta` | L | Aperçu d'expansion behaviors → DeltaSpec (dry-run) |

---

## Runtime Roadmap

| Tool | Mode | Description |
|------|------|-------------|
| `dtfs__describe_runtime_roadmap` | L | 12 capacités V3 planifiées |

---

## Utility

| Tool | Mode | Description |
|------|------|-------------|
| `echo` | L | Echo string de test |
