# MCP Tools Reference

All tools exposed by `createMcpServer()` in `backend/src/mcp.ts`.
Tools marked **MVP** belong to the Phase 13 plan MVP list.

---

## Spec & Introspection

| Tool | MVP | Input | Output | Wraps |
|------|-----|-------|--------|-------|
| `dtfs__list_projects` | ✓ | — | `[{id,slug,updatedAt,_count}]` | `prisma.project.findMany` |
| `dtfs__get_project_spec` | ✓ | `projectId`, `format?` (json\|md) | full spec JSON or Markdown | `lib/spec.getSpec` + `renderSpecMd` |
| `dtfs__describe_concept` | ✓ | `concept` enum | doc string | `CONCEPT_DOCS` constant |
| `dtfs__list_expr_functions` | ✓ | — | `{functions:[{name,args,pure}]}` | `lib/dsl/expr-ast.EXPR_FUNCTIONS` |
| `dtfs__list_behaviors` | ✓ | — | behavior catalogue JSON | `lib/behaviors.describeCatalogue` |
| `dtfs__expand_behaviors` | | `projectId` | expansion preview | `spec.expandBehaviors` |
| `dtfs__validate_spec` | ✓ | `projectId`, `operations?`, `policies?` | `{ok,errors[]}` | `spec.validateProposal` |

---

## History / ChangeSets

| Tool | MVP | Input | Output | Wraps |
|------|-----|-------|--------|-------|
| `dtfs__begin_changeset` | ✓ | `projectId`, `message` | `{changeSetId}` | `prisma.changeSet.create` |
| `dtfs__commit_changeset` | ✓ | `changeSetId` | `{ok,status}` | `prisma.changeSet.update` |
| `dtfs__discard_changeset` | ✓ | `changeSetId` | `{ok}` | `prisma.changeSet.delete` + revisions |
| `dtfs__revert_changeset` | ✓ | `changeSetId` | `{revertChangeSetId,entries}` | `lib/revert.revertOne` loop |
| `dtfs__apply_delta_spec` | | `projectId`, `changeSetId`, `deltaSpec`, `dryRun?` | apply result | `lib/delta-spec-apply.applyDeltaSpec` |
| `dtfs__apply_spec` | ✓ | `projectId`, `changeSetId`, `deltaSpec`, `dryRun?` | apply result | alias → `lib/delta-spec-apply.applyDeltaSpec` |
| `dtfs__get_spec_at` | | `projectId`, `atVersion` | spec snapshot | `lib/spec-snapshot.getSpecAt` |
| `dtfs__diff_changesets` | | `csIdA`, `csIdB` | diff object | `lib/changeset-diff.diffChangeSets` |
| `dtfs__list_history` | | `projectId`, `limit?` | `[ChangeSet]` | `prisma.changeSet.findMany` |
| `dtfs__describe_changeset` | | `changeSetId` | ChangeSet + revisions | `prisma.changeSet.findUnique` |
| `dtfs__revert_revision` | | `revisionId` | `{changeSetId,entry}` | `lib/revert.revertOne` |
| `dtfs__revert_field` | | `revisionId`, `field` | `{changeSetId,entry}` | `lib/revert.revertField` |

---

## Phase 1 — ProductSpec

| Tool | MVP | Input | Output | Wraps |
|------|-----|-------|--------|-------|
| `dtfs__list_product_specs` | | `projectId` | `[ProductSpec]` | `prisma.productSpec.findMany` |
| `dtfs__get_product_spec` | | `productSpecId` | `ProductSpec` | `prisma.productSpec.findUnique` |
| `dtfs__create_product_spec` | | `projectId` + spec fields | `ProductSpec` | `prisma.productSpec.create` |
| `dtfs__create_product_spec_from_prompt` | ✓ | same as above | `ProductSpec` | alias → `prisma.productSpec.create` |
| `dtfs__update_product_spec` | | `productSpecId`, `patch` | `ProductSpec` | `prisma.productSpec.update` |
| `dtfs__validate_product_spec` | | `productSpecId` | `{complete,checks[]}` | `lib/product-spec-validation.validateProductSpec` |

---

## Phase 2 — ScreenSpec

| Tool | MVP | Input | Output | Wraps |
|------|-----|-------|--------|-------|
| `dtfs__list_screen_specs` | | `projectId` | `[ScreenSpec]` | `prisma.screenSpec.findMany` |
| `dtfs__get_screen_spec` | | `screenSpecId` | `ScreenSpec` | `prisma.screenSpec.findUnique` |
| `dtfs__create_screen_spec` | | `projectId` + spec fields | `ScreenSpec` | `prisma.screenSpec.create` |
| `dtfs__create_screen_spec_from_prompt` | ✓ | same as above | `ScreenSpec` | alias → `prisma.screenSpec.create` |
| `dtfs__update_screen_spec` | | `screenSpecId`, `patch` | `ScreenSpec` | `prisma.screenSpec.update` |
| `dtfs__validate_screen_spec` | | `screenSpecId` | `{complete,checks[]}` | `lib/screen-spec-validation.validateScreenSpec` |

---

## Phase 3 — Clarification (OpenQuestions + Assumptions)

| Tool | MVP | Input | Output | Wraps |
|------|-----|-------|--------|-------|
| `dtfs__list_open_questions` | ✓ | `projectId`, `status?` | `[OpenQuestion]` | `prisma.openQuestion.findMany` |
| `dtfs__create_open_question` | | `projectId`, `scope`, `question`, `targetId?` | `OpenQuestion` | `prisma.openQuestion.create` |
| `dtfs__answer_open_question` | ✓ | `openQuestionId`, `answer` | `OpenQuestion` | `prisma.openQuestion.update` |
| `dtfs__defer_open_question` | | `openQuestionId` | `OpenQuestion` | `prisma.openQuestion.update` |
| `dtfs__list_assumptions` | | `projectId`, `status?` | `[Assumption]` | `prisma.assumption.findMany` |
| `dtfs__create_assumption` | | `projectId`, `scope`, `text`, `targetId?` | `Assumption` | `prisma.assumption.create` |
| `dtfs__accept_assumption` | | `assumptionId` | `Assumption` | `prisma.assumption.update` |
| `dtfs__reject_assumption` | | `assumptionId`, `reason?` | `Assumption` | `prisma.assumption.update` |
| `dtfs__check_clarification_gate` | | `projectId` | `{blocking,count}` | `lib/clarification-gate.checkClarificationGate` |

---

## Phase 4 — Spec Kit / SDD Artifacts

| Tool | MVP | Input | Output | Wraps |
|------|-----|-------|--------|-------|
| `dtfs__list_sdd_artifacts` | | `projectId`, `kind?`, `featureKey?` | `[SpecArtifact]` | `prisma.specArtifact.findMany` |
| `dtfs__read_sdd_artifact` | | `projectId`, `kind`, `featureKey?` | `SpecArtifact` | `prisma.specArtifact.findFirst` |
| `dtfs__generate_sdd_artifacts` | ✓ | `projectId`, `featureKey?`, `source?`, `artifacts[]` | `{upserted[]}` | `prisma.specArtifact` upsert loop |
| `dtfs__sync_speckit_artifacts` | ✓ | `projectId`, `direction`, `featureKey?` | sync result | `lib/spec-kit-sync.syncToDisk` / `syncFromDisk` |
| `dtfs__validate_sdd_artifacts` | ✓ | `projectId`, `featureKey?` | `{ok,missing[]}` | `lib/sdd-validation.validateSddArtifacts` |

---

## Phase 5 — Requirements + Platform Mapping

| Tool | MVP | Input | Output | Wraps |
|------|-----|-------|--------|-------|
| `dtfs__list_requirements` | | `projectId`, `status?`, `priority?`, `productSpecId?` | `[Requirement]` | `prisma.requirement.findMany` |
| `dtfs__get_requirement` | | `requirementId` | `Requirement` + mappings | `prisma.requirement.findUnique` |
| `dtfs__extract_requirements` | | `projectId`, `featureKey`, `requirements[]` | `{upserted[]}` | `prisma.requirement` upsert loop |
| `dtfs__accept_requirement` | | `requirementId` | `Requirement` | `prisma.requirement.update` |
| `dtfs__reject_requirement` | | `requirementId` | `Requirement` | `prisma.requirement.update` |
| `dtfs__map_requirements_to_platform` | | `projectId`, `mappings[]` | `{created[]}` | `prisma.requirementMapping.create` loop |
| `dtfs__list_requirement_mappings` | | `projectId`, `requirementId?`, `targetType?` | `[RequirementMapping]` | `prisma.requirementMapping.findMany` |
| `dtfs__validate_requirement_coverage` | | `projectId` | `{ok,uncovered[]}` | `lib/coverage-gate.checkCoverageGate` |

---

## Phase 6 — PlatformSpec Proposal

| Tool | MVP | Input | Output | Wraps |
|------|-----|-------|--------|-------|
| `dtfs__propose_platform_spec` | ✓ | `projectId`, `featureKey?` | `{id,envelope}` | `lib/platform-proposal.buildProposalSkeleton` |
| `dtfs__map_screens_to_platform` | | `projectId`, `featureKey?` | `{proposals[]}` | `prisma.screenSpec` + `prisma.screen` |
| `dtfs__list_platform_proposals` | | `projectId`, `status?` | `[PlatformSpecProposal]` | `prisma.platformSpecProposal.findMany` |
| `dtfs__get_platform_proposal` | | `proposalId` | `PlatformSpecProposal` | `prisma.platformSpecProposal.findUnique` |
| `dtfs__accept_platform_proposal` | | `proposalId`, `rationale?` | `PlatformSpecProposal` | `prisma.platformSpecProposal.update` |
| `dtfs__reject_platform_proposal` | | `proposalId`, `rationale?` | `PlatformSpecProposal` | `prisma.platformSpecProposal.update` |
| `dtfs__validate_platform_proposal` | | `proposalId` | `{checks[]}` | `lib/platform-proposal-validation.validateProposalEnvelope` |

---

## Phase 7 — DeltaSpec

| Tool | MVP | Input | Output | Wraps |
|------|-----|-------|--------|-------|
| `dtfs__create_delta_from_platform_proposal` | ✓ | `projectId`, `proposalId` | `{deltaSpec}` | `lib/delta-spec-compile.compileProposalToDelta` |
| `dtfs__validate_delta_spec` | | `projectId`, `deltaSpec` | `{ok,errors[]}` | `lib/delta-spec-validation.validateDeltaSpec` |
| `dtfs__explain_delta_spec` | ✓ | `projectId`, `deltaSpec` | `{markdown}` | `lib/delta-spec-explain.explainDeltaSpec` |

---

## Phase 8 — Expr DSL

| Tool | MVP | Input | Output | Wraps |
|------|-----|-------|--------|-------|
| `dtfs__list_expr_functions` | ✓ | — | `{functions:[{name,args,pure}]}` | `lib/dsl/expr-ast.EXPR_FUNCTIONS` |
| `dtfs__validate_expr` | | `expr`, `stepAliases?` | `{ok,errors[]}` | `lib/dsl/expr-validate.validateExpr` |
| `dtfs__eval_expr` | | `expr`, `scope?` | `{value}` or `{error}` | `lib/dsl/expr-eval.evalExpr` |
| `dtfs__analyze_expr` | | `expr` | `{refs,calls,inferredType}` | `lib/dsl/expr-analyze.*` |

---

## Operation DSL

| Tool | MVP | Input | Output | Wraps |
|------|-----|-------|--------|-------|
| `dtfs__list_operation_step_kinds` | | — | `{kinds:[{kind,description}]}` | `lib/dsl/operation-dsl.OPERATION_STEP_KINDS` |
| `dtfs__validate_operation_body` | | `projectId`, `body[]` | `{ok,errors[]}` | `lib/dsl/operation-validate.validateOperationBody` |
| `dtfs__analyze_operation_body` | | `body[]` | `{entities,policies,integrations,events}` | `lib/dsl/operation-analyze.*` |

---

## Policy DSL

| Tool | MVP | Input | Output | Wraps |
|------|-----|-------|--------|-------|
| `dtfs__validate_policy_rule` | | `rule` | `{ok,errors[]}` | `lib/dsl/policy-validate.validatePolicyRule` |
| `dtfs__list_policy_rule_ops` | | — | `{ops[]}` | `lib/dsl/policy-dsl.POLICY_RULE_OPS` |
| `dtfs__eval_policy_rule` | | `rule`, `scope?` | `{value:boolean}` | `lib/dsl/policy-eval.evalPolicyRule` |

---

## Phase 14 — HTML / Figma Import

| Tool | MVP | Input | Output | Wraps |
|------|-----|-------|--------|-------|
| `dtfs__analyze_html` | | `html` | structural analysis (forms, fields, actions, assets) | `lib/import/html-analyze.analyzeHtml` |
| `dtfs__diff_html` | | `projectId`, `screenSpecId`, `html` | `{uiDelta}` mismatches vs existing ScreenSpec | `lib/import/html-diff.diffHtmlAgainstScreenSpec` |
| `dtfs__import_html_proposal` | | `projectId`, `html`, `featureKey?`, `screenSpecId?` | `{id, proposal}` — DRAFT PlatformSpecProposal | `lib/import/html-to-proposal.htmlAnalysisToProposal` |
| `dtfs__analyze_figma` | | `figmaJson?`, `fileKey?` | `DesignAnalysis` or `{error}` | `lib/import/figma-analyze.resolveFigmaAnalysis` |
| `dtfs__import_design_proposal` | | `projectId`, `figmaJson?`, `fileKey?`, `featureKey?` | `{id, proposal}` — DRAFT PlatformSpecProposal | `lib/import/figma-analyze.designAnalysisToProposal` |

---

## Phase 17 — Codegen

| Tool | MVP | Input | Output | Wraps |
|------|-----|-------|--------|-------|
| `dtfs__generate_app` | ✓ | `projectId`, `dryRun?`, `outDir?` | `{outDir, files, counts}` | `codegen/codegen.generateApp` |
| `dtfs__preview_generated_file` | | `projectId`, `path` | `{content}` — single file regenerated in memory | `codegen/codegen.generateApp` (dryRun) |

---

## Phase 19 — Governance

| Tool | MVP | Input | Output | Wraps |
|------|-----|-------|--------|-------|
| `dtfs__run_governance_checks` | | `projectId`, `deltaSpec`, `confirmDeletes?` | `{ok, violations, passed}` | `lib/governance/governance-check.runGovernanceChecks` |
| `dtfs__read_audit_log` | | `projectId?`, `action?`, `limit?` | `{events, count}` — reverse-chronological | `lib/governance/audit.readAuditLog` |

---

## Phase 21 — Runtime Roadmap

| Tool | MVP | Input | Output | Wraps |
|------|-----|-------|--------|-------|
| `dtfs__describe_runtime_roadmap` | | — | `{roadmap}` — 12 V3 planned capabilities, read-only | `runtime/index.describeRuntimeRoadmap` |

---

## Behaviors (additional tool)

| Tool | MVP | Input | Output | Wraps |
|------|-----|-------|--------|-------|
| `dtfs__expand_behaviors_to_delta` | | `projectId`, `entities?` | DeltaSpec expansion preview — dry-run, no DB write | `spec.expandBehaviors` (entity/behavior pairs) |

---

## Utility

| Tool | MVP | Input | Output | Wraps |
|------|-----|-------|--------|-------|
| `echo` | | `message` | echo string | — |

---

**Total: 84 tools** (83 `dtfs__*` + 1 `echo`; 21 MVP + 63 supporting)

> **Sync note (updated Phase 24):** this doc previously listed 73 tools (missing 11). The 11 tools
> added above (`dtfs__analyze_html`, `dtfs__diff_html`, `dtfs__import_html_proposal`,
> `dtfs__analyze_figma`, `dtfs__import_design_proposal`, `dtfs__generate_app`,
> `dtfs__preview_generated_file`, `dtfs__run_governance_checks`, `dtfs__read_audit_log`,
> `dtfs__describe_runtime_roadmap`, `dtfs__expand_behaviors_to_delta`) were already registered
> in `backend/src/mcp.ts` but not documented here. Count verified via:
> `grep -oP '"dtfs__[a-z_]+"' backend/src/mcp.ts | sort -u`

---

## Phase 26 — Contracts (registered Phase 26)

These 7 tools were registered in `backend/src/mcp.ts` as part of Phase 26:

| Tool | Input | Output |
|------|-------|--------|
| `dtfs__get_runtime_target` | `projectId`, `name?` | `RuntimeTarget` |
| `dtfs__set_runtime_target` | `projectId`, `config` | `RuntimeTarget` |
| `dtfs__compile_backend_contract` | `projectId` | `BackendContract` |
| `dtfs__compile_frontend_contract` | `projectId` | `FrontendContract` |
| `dtfs__compile_shared_contract` | `projectId` | `SharedContract` |
| `dtfs__validate_contracts` | `projectId` | `{ok, errors[]}` |
| `dtfs__explain_contracts` | `projectId` | markdown explanation |

## Phase 28 — Granular code-generation tools (not yet registered — pending Phase 28)

These tools are planned for Phase 28 when per-layer generation is implemented:

| Tool | Input | Output |
|------|-------|--------|
| `dtfs__plan_codegen` | `projectId` | ordered file generation plan |
| `dtfs__generate_database_schema` | `projectId`, `dryRun?` | Prisma schema artifact |
| `dtfs__generate_auth_runtime` | `projectId`, `dryRun?` | `auth.ts` artifact |
| `dtfs__generate_backend_api` | `projectId`, `dryRun?` | Hono routes artifacts |
| `dtfs__generate_frontend_next` | `projectId`, `dryRun?` | Next pages artifacts |
| `dtfs__generate_shared_sdk` | `projectId`, `dryRun?` | `packages/shared/` artifacts |
| `dtfs__generate_tests` | `projectId`, `dryRun?` | test file artifacts |
| `dtfs__check_generated_project` | `projectId` | `{ok, issues[]}` |
| `dtfs__typecheck_generated_project` | `projectId` | `{ok, errors[]}` |
| `dtfs__run_generated_tests` | `projectId` | `{ok, results[]}` |
| `dtfs__diff_generated_artifacts` | `projectId`, `fromChangeSetId`, `toChangeSetId` | artifact diff |
