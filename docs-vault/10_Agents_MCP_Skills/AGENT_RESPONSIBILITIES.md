# Agent Responsibilities

Table de référence des 19 agents DTFS : responsabilité, inputs, outputs, outils autorisés, interdictions, fichiers concernés.

Liens : [[AGENTS_OVERVIEW]] · [[MCP_TOOLS]] · [[../09_ADR/ADR-0008-use-contract-compilation-before-codegen]].

## Source of truth

`.claude/agents/dtfs-*.md` — chaque fichier est la définition canonique de l'agent.

## AI usage

Consulter ce tableau avant d'invoquer un agent pour s'assurer qu'il est dans sa responsabilité. Les chevauchements identifiés par l'audit sont signalés.

## Status

Actif — 19 agents. Chevauchements identifiés : 2 (signalés ci-dessous).

---

## Agents — pipeline naturel

### dtfs-product-analyst
| Aspect | Détail |
|--------|--------|
| Responsabilité | Texte libre → `ProductSpec` structuré et validé |
| Input | Description naturelle + `projectId` |
| Output | `ProductSpec` persisté + `{productSpecId, complete, openQuestions, assumptions}` |
| Outils autorisés | `dtfs__list_projects`, `dtfs__create/update/get/list/validate_product_spec`, `dtfs__describe_concept`, Read, Glob, Grep |
| Interdictions | Pas de DeltaSpec, pas de ChangeSet, pas de mutation Control Plane autre que ProductSpec |
| Fichiers | Aucun fichier disque — persistance via MCP uniquement |

### dtfs-screen-spec-writer
| Aspect | Détail |
|--------|--------|
| Responsabilité | Description d'écran / artefact design → `ScreenSpec` |
| Input | Description UI ou artefact Figma/HTML + `projectId` |
| Output | `ScreenSpec` persisté + validation |
| Outils autorisés | `dtfs__create/update/get/list/validate_screen_spec`, `dtfs__describe_concept`, `dtfs__analyze_html`, `dtfs__analyze_figma` |
| Interdictions | Pas de DeltaSpec, pas d'Entités |
| Fichiers | Aucun fichier disque |

### dtfs-question-manager
| Aspect | Détail |
|--------|--------|
| Responsabilité | Résoudre les `OpenQuestion` et `Assumption` via dialogue utilisateur |
| Input | `projectId` + liste des questions/assumptions OPEN |
| Output | Questions répondues/déférées, clarification gate verte |
| Outils autorisés | `dtfs__list/create/answer/defer_open_question`, `dtfs__list/create/accept/reject_assumption`, `dtfs__check_clarification_gate` |
| Interdictions | Pas de mutation spec, pas de DeltaSpec |
| Fichiers | Aucun |

### dtfs-sdd-writer
| Aspect | Détail |
|--------|--------|
| Responsabilité | Générer les artefacts Spec Kit (constitution, spec, plan, tasks, platform-mapping) |
| Input | `projectId` + `featureKey` |
| Output | `SpecArtifact` rows en base + sync disque optionnel |
| Outils autorisés | `dtfs__generate_sdd_artifacts`, `dtfs__sync_speckit_artifacts`, `dtfs__validate_sdd_artifacts`, `dtfs__list/read_sdd_artifact` |
| Interdictions | Pas de DeltaSpec, pas de Requirement, pas de PlatformSpec |
| Fichiers | `speckit/<featureKey>/{constitution,spec,plan,tasks,platform-mapping}.md` |

### dtfs-sdd-reviewer
| Aspect | Détail |
|--------|--------|
| Responsabilité | Cross-checker les artefacts SDD contre ProductSpec + ScreenSpec |
| Input | `projectId` + `featureKey` |
| Output | Rapport de cohérence (conflits, omissions) |
| Outils autorisés | `dtfs__read_sdd_artifact`, `dtfs__get_product_spec`, `dtfs__get_screen_spec`, `dtfs__validate_sdd_artifacts` |
| Interdictions | Pas de mutation, read-only |
| Fichiers | Aucun |

### dtfs-requirement-extractor
| Aspect | Détail |
|--------|--------|
| Responsabilité | Extraire les `Requirement` rows depuis SDD + ProductSpec |
| Input | `projectId` + `featureKey` |
| Output | `Requirement` rows persistées + `accept/reject` |
| Outils autorisés | `dtfs__extract_requirements`, `dtfs__list/get/accept/reject_requirement`, `dtfs__read_sdd_artifact` |
| Interdictions | Pas de mapping, pas de DeltaSpec |
| Fichiers | Aucun |

### dtfs-platform-mapper
| Aspect | Détail |
|--------|--------|
| Responsabilité | Mapper Requirements → Control Plane targets + créer `PlatformSpecProposal` DRAFT |
| Input | `projectId` + `featureKey?` |
| Output | `RequirementMapping` rows + `PlatformSpecProposal` DRAFT |
| Outils autorisés | `dtfs__map_requirements_to_platform`, `dtfs__validate_requirement_coverage`, `dtfs__propose_platform_spec`, `dtfs__map_screens_to_platform`, `dtfs__list/get/accept/reject/validate_platform_proposal`, `dtfs__create_open_question` |
| Interdictions | Jamais `apply_spec` ou `apply_delta_spec` — le mapper ne touche pas le spec live |
| Fichiers | Aucun |
| **Chevauchement** | Possède `dtfs__accept_platform_proposal` — même outil que `dtfs-spec-writer`. Propriétaire légitime : spec-writer (post-review). Le mapper peut accepter en pré-validation ; clarifier le flow (voir audit P1). |

### dtfs-spec-writer
| Aspect | Détail |
|--------|--------|
| Responsabilité | Proposal ACCEPTED → `DeltaSpec` validé + expliqué (jamais appliqué) |
| Input | `projectId` + `proposalId` (status=ACCEPTED) |
| Output | `DeltaSpec` objet + rapport validation + explication humaine |
| Outils autorisés | `dtfs__create_delta_from_platform_proposal`, `dtfs__validate_spec`, `dtfs__validate_delta_spec`, `dtfs__explain_delta_spec`, `dtfs__accept_platform_proposal`, `dtfs__list/get_platform_proposal`, `dtfs__get_project_spec` |
| Interdictions | Jamais `apply_spec` ou `apply_delta_spec` |
| Fichiers | Aucun |
| **Chevauchement** | `dtfs__accept_platform_proposal` partagé avec platform-mapper (voir ci-dessus) |

### dtfs-spec-validator
| Aspect | Détail |
|--------|--------|
| Responsabilité | Validation read-only de DeltaSpec, opérations, politiques, expressions, proposals |
| Input | Tout artefact à valider + `projectId` |
| Output | `{ok, errors[], warnings[]}` |
| Outils autorisés | `dtfs__validate_spec`, `dtfs__validate_delta_spec`, `dtfs__validate_platform_proposal`, `dtfs__validate_expr`, `dtfs__validate_operation_body`, `dtfs__validate_policy_rule`, `dtfs__run_governance_checks` |
| Interdictions | Aucune mutation |
| Fichiers | Aucun |

### dtfs-diff-explainer
| Aspect | Détail |
|--------|--------|
| Responsabilité | Expliquer les ChangeSets et diffs DeltaSpec en langage naturel |
| Input | `changeSetId` ou `deltaSpec` |
| Output | Markdown explicatif |
| Outils autorisés | `dtfs__describe_changeset`, `dtfs__diff_changesets`, `dtfs__explain_delta_spec`, `dtfs__list_history` |
| Interdictions | Aucune mutation |
| Fichiers | Aucun |

---

## Agents — Runtime & Codegen

### dtfs-runtime-architect
| Aspect | Détail |
|--------|--------|
| Responsabilité | Choisir et persister le `RuntimeTarget` (stack versions, outputDir) |
| Input | `projectId` + préférences stack optionnelles |
| Output | `RuntimeTarget` persisté + tableau récapitulatif |
| Outils autorisés | `dtfs__get/set_runtime_target`, `dtfs__describe_runtime_roadmap`, `dtfs__get_project_spec`, Read |
| Interdictions | Pas de compile, pas de generate |
| Fichiers | Aucun |

### dtfs-backend-contract-compiler
| Aspect | Détail |
|--------|--------|
| Responsabilité | Compiler le `BackendContract` et valider/expliquer les erreurs |
| Input | `projectId` |
| Output | `BackendContract` persisté ou rapport d'erreurs |
| Outils autorisés | `dtfs__compile_backend_contract`, `dtfs__validate_contracts`, `dtfs__explain_contracts`, `dtfs__get_project_spec` |
| Interdictions | Pas de génération de code |
| Fichiers | Aucun |

### dtfs-frontend-contract-compiler
| Aspect | Détail |
|--------|--------|
| Responsabilité | Compiler le `FrontendContract` et valider la cohérence |
| Input | `projectId` |
| Output | `FrontendContract` persisté ou rapport d'erreurs |
| Outils autorisés | `dtfs__compile_frontend_contract`, `dtfs__validate_contracts`, `dtfs__explain_contracts`, `dtfs__get_project_spec` |
| Interdictions | Pas de génération de code |
| Fichiers | Aucun |

### dtfs-shared-contract-compiler
| Aspect | Détail |
|--------|--------|
| Responsabilité | Compiler le `SharedContract` (Zod schemas, AppType) |
| Input | `projectId` |
| Output | `SharedContract` persisté |
| Outils autorisés | `dtfs__compile_shared_contract`, `dtfs__validate_contracts`, `dtfs__get_project_spec` |
| Interdictions | Pas de génération de code |
| Fichiers | Aucun |

### dtfs-hono-api-generator
| Aspect | Détail |
|--------|--------|
| Responsabilité | Générer les routes Hono 4 depuis le BackendContract |
| Input | `projectId` + `outDir?` |
| Output | Fichiers `apps/api/src/routes/*.ts` (via `dtfs__generate_app`) |
| Outils autorisés | `dtfs__generate_app`, `dtfs__preview_generated_file`, `dtfs__get_project_spec` |
| Interdictions | Toujours dry-run d'abord |
| Fichiers | `apps/api/src/routes/<resource>.ts` (dans outDir) |

### dtfs-better-auth-generator
| Aspect | Détail |
|--------|--------|
| Responsabilité | Générer `auth.ts` et le middleware Better Auth |
| Input | `projectId` + `outDir?` |
| Output | `apps/api/src/auth.ts` (via `dtfs__generate_app`) |
| Outils autorisés | `dtfs__generate_app`, `dtfs__preview_generated_file` |
| Interdictions | Toujours dry-run d'abord |
| Fichiers | `apps/api/src/auth.ts` (dans outDir) |

### dtfs-next16-generator
| Aspect | Détail |
|--------|--------|
| Responsabilité | Générer les pages Next.js 16 App Router |
| Input | `projectId` + `outDir?` |
| Output | `apps/web/app/**/*.tsx` (via `dtfs__generate_app`) |
| Outils autorisés | `dtfs__generate_app`, `dtfs__preview_generated_file`, `dtfs__compile_frontend_contract` |
| Interdictions | Toujours dry-run d'abord |
| Fichiers | `apps/web/app/` (dans outDir) |

### dtfs-sdk-generator
| Aspect | Détail |
|--------|--------|
| Responsabilité | Générer le package SDK partagé |
| Input | `projectId` + `outDir?` |
| Output | `packages/shared/src/**` (via `dtfs__generate_app`) |
| Outils autorisés | `dtfs__generate_app`, `dtfs__preview_generated_file`, `dtfs__compile_shared_contract` |
| Interdictions | Toujours dry-run d'abord |
| Fichiers | `packages/shared/` (dans outDir) |

### dtfs-codegen-orchestrator
| Aspect | Détail |
|--------|--------|
| Responsabilité | Orchestrer le pipeline complet : contracts → generate_app |
| Input | `projectId` + `outDir?` + `dryRun?` |
| Output | Plan de génération + fichiers générés + rapport |
| Outils autorisés | `dtfs__get_project_spec`, `dtfs__get_runtime_target`, `dtfs__compile_*_contract`, `dtfs__validate_contracts`, `dtfs__explain_contracts`, `dtfs__generate_app`, `dtfs__preview_generated_file`, Read, Bash |
| Interdictions | Ne modifie pas le Control Plane. Toujours dry-run avant write. |
| Fichiers | Tout `outDir` (hors repo DTFS) |

### dtfs-generated-code-reviewer
| Aspect | Détail |
|--------|--------|
| Responsabilité | Auditer le code généré : structure, fichiers protégés, TypeScript, heuristiques |
| Input | `projectId` + `outDir` |
| Output | Rapport PASS/WARNINGS/BLOCKED |
| Outils autorisés | Read, Bash, `dtfs__preview_generated_file`, `dtfs__get_project_spec`, `dtfs__get_runtime_target` |
| Interdictions | Read-only — ne modifie aucun fichier |
| Fichiers | Read-only sur `outDir` |
| **Audit P1** | L'agent devrait aussi avoir `dtfs__check_generated_project` + `dtfs__typecheck_generated_project` dans ses tools (non enregistrés actuellement) |
