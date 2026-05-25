# Architecture Audit — Step 22+23

> Audit date: 2026-05-24 — read-only pass over the repo. No code was modified.

---

## 1. Prisma Models

Total models in `backend/prisma/schema.prisma`: **48**

| # | Model | Added by |
|---|-------|---------|
| 1 | User | init |
| 2 | Session | init |
| 3 | Account | init |
| 4 | Verification | init |
| 5 | Locale | init |
| 6 | TextKey | init |
| 7 | Translation | init |
| 8 | Project | init |
| 9 | ProjectLocale | init |
| 10 | Theme | init |
| 11 | Entity | control_plane_v1 |
| 12 | Attribute | control_plane_v1 |
| 13 | EntityRecord | control_plane_v1 |
| 14 | Screen | control_plane_v1 |
| 15 | Component | control_plane_v1 |
| 16 | Form | control_plane_v1 |
| 17 | Field | control_plane_v1 |
| 18 | FieldOption | control_plane_v1 |
| 19 | Revision | control_plane_v1 |
| 20 | EntityRelation | control_plane_v1 |
| 21 | Resource | control_plane_v1 |
| 22 | Operation | control_plane_v1 |
| 23 | Policy | control_plane_v1 |
| 24 | Integration | control_plane_v1 |
| 25 | Trigger | control_plane_v1 |
| 26 | Behavior | control_plane_v1 |
| 27 | ChangeSet | control_plane_v1 |
| 28 | ProductSpec | product_spec_typed |
| 29 | ScreenSpec | screen_spec_typed |
| 30 | OpenQuestion | clarification_typed |
| 31 | Assumption | clarification_typed |
| 32 | SpecArtifact | spec_artifact_typed |
| 33 | Requirement | requirement_mapping_typed |
| 34 | RequirementMapping | requirement_mapping_typed |
| 35 | Workflow | phase_0_skeleton |
| 36 | Asset | phase_0_skeleton |
| 37 | AuthMethod | phase_0_skeleton |
| 38 | Secret | phase_0_skeleton |
| 39 | Environment | phase_0_skeleton |
| 40 | AppRole | phase_0_skeleton |
| 41 | EventDefinition | phase_0_skeleton |
| 42 | Action | phase_0_skeleton |
| 43 | DataBinding | phase_0_skeleton |
| 44 | GeneratedArtifact | phase_0_skeleton |
| 45 | DeploymentTarget | phase_0_skeleton |
| 46 | TestScenario | phase_0_skeleton |
| 47 | AuditLog | phase_0_skeleton |
| 48 | PlatformSpecProposal | platform_spec_proposal |

**Models NOT yet in the schema (to add in Phase 25):**

- `RuntimeTarget` — not present
- `BackendContract` — not present
- `FrontendContract` — not present
- `SharedContract` — not present

`GeneratedArtifact` exists but will be enriched (fields `runtimeTargetId`, contract linkage) in Phase 25.

---

## 2. Migrations

| Directory | Status |
|-----------|--------|
| `20260523093454_init_dtfs` | applied |
| `20260523101520_scope_textkey_to_project` | applied |
| `20260523101826_add_screen_type` | applied |
| `20260524065316_project_metadata` | applied |
| `20260524074433_control_plane_v1` | applied |
| `20260524081444_phase_0_skeleton` | applied |
| `20260524082759_product_spec_typed` | applied |
| `20260524083816_screen_spec_typed` | applied |
| `20260524085127_clarification_typed` | applied |
| `20260524090541_spec_artifact_typed` | applied |
| `20260524092941_requirement_mapping_typed` | applied |
| `20260524100039_platform_spec_proposal` | applied |
| `20260524110000_phase_10_enriched_models` | **NOT applied** |

**Total: 13 migrations, 1 pending.**

The pending migration `phase_10_enriched_models` adds:
- 7 new enums (`SecretRefKind`, `ActionKind`, `DataBindingSource`, `GeneratedArtifactKind`, `DeploymentTargetKind`, `TestScenarioKind`, `TestScenarioStatus`)
- `API_KEY` value to existing `AuthMethodKind` enum
- Column additions to `Action`, `AppRole`, `Asset`, `AuditLog`, `DataBinding`, `DeploymentTarget`, `Environment`, `EventDefinition`, `GeneratedArtifact`, `Secret`, `TestScenario`
- Drop of legacy columns from `Assumption`, `OpenQuestion`, `ProductSpec`, `Requirement`, `RequirementMapping`, `ScreenSpec`
- 3 new foreign-key constraints

This migration must be applied (gated) before Phase 25 model additions.

---

## 3. Existing Docs (`docs/`)

| File | Role |
|------|------|
| `ARCHITECTURE.md` | High-level platform architecture and layer diagram |
| `BACKEND_MODEL.md` | Canonical Control Plane vocabulary reference (all models) |
| `BEHAVIORS.md` | Behavior macro system — expansion into operation steps |
| `CHANGESET_AUDIT.md` | Audit snapshot of ChangeSet system (date: 2026-05-24) |
| `CHANGESET_FLOW.md` | How every Control Plane write is grouped under a ChangeSet |
| `CODEGEN_CONTRACT.md` | Codegen as layer 9: what it reads, what it must not do |
| `CODEGEN.md` | `backend/src/codegen/` module description (Phase 17) |
| `DELTA_SPEC.md` | DeltaSpec format — the only authorized write format |
| `EXECUTION_FLOW.md` | Concrete walk-through: idea → deployable app |
| `EXPR_DSL.md` | Expr expression syntax used in Step DSL |
| `GOVERNANCE.md` | Guardrails, audit trail, coverage gates |
| `HARNESS.md` | Claude Code tooling layer description |
| `HTTP_API.md` | All Hono HTTP endpoints (prefixed base URL) |
| `IMPORT.md` | Phase 14 HTML/Figma import pipeline |
| `MCP_TOOLS.md` | All MCP tools exposed by `createMcpServer()` |
| `OPERATION_DSL.md` | Operation.steps typed step DSL |
| `PLUGINS.md` | Claude Code plugin manifest description |
| `POLICY_DSL.md` | Policy.rule recursive DSL |
| `RUNTIME_ROADMAP.md` | V3 planned runtime capabilities (none implemented) |
| `SCHEMA_INVENTORY.md` | Generated model inventory (Step 10) |
| `SPECKIT_INTEGRATION.md` | Spec Kit disk sync integration |
| `TESTING.md` | Testing philosophy and test harness |
| `PHASES/PHASE_1.md` through `PHASE_6.md` | Per-phase delivery notes |

**Total: 22 markdown files + 6 phase files = 28 docs.**

**Not yet in docs (to add in Phase 24):**
`RUNTIME_TARGET.md`, `BACKEND_CONTRACT.md`, `FRONTEND_CONTRACT.md`, `SHARED_CONTRACT.md`, `HONO_GENERATION.md`, `BETTER_AUTH_GENERATION.md`, `NEXT16_GENERATION.md`, `SDK_GENERATION.md`, `GENERATED_ARTIFACTS.md`

---

## 4. MCP Tools

**Source truth: `backend/src/mcp.ts`**

Total registered tools: **84** (83 `dtfs__*` + 1 `echo`)

The `docs/MCP_TOOLS.md` documents 72 `dtfs__*` tools — 11 tools exist in source but are not yet documented:

Tools in `mcp.ts` not in `MCP_TOOLS.md`:
- `dtfs__analyze_figma`
- `dtfs__analyze_html`
- `dtfs__describe_runtime_roadmap`
- `dtfs__diff_html`
- `dtfs__expand_behaviors_to_delta`
- `dtfs__generate_app`
- `dtfs__import_design_proposal`
- `dtfs__import_html_proposal`
- `dtfs__preview_generated_file`
- `dtfs__read_audit_log`
- `dtfs__run_governance_checks`

Categories (from `MCP_TOOLS.md`):
1. Spec & Introspection (7)
2. History / ChangeSets (12)
3. Phase 1 — ProductSpec (6)
4. Phase 2 — ScreenSpec (6)
5. Phase 3 — Clarification (9)
6. Phase 4 — Spec Kit / SDD Artifacts (5)
7. Phase 5 — Requirements + Platform Mapping (8)
8. Phase 6 — PlatformSpec Proposal (7)
9. Phase 7 — DeltaSpec (3)
10. Phase 8 — Expr DSL (4)
11. Operation DSL (3)
12. Policy DSL (3)
13. Utility (1 — echo)

**Tools to add in Phase 26 (not yet registered):**
`dtfs__get_runtime_target`, `dtfs__set_runtime_target`, `dtfs__compile_backend_contract`, `dtfs__compile_frontend_contract`, `dtfs__compile_shared_contract`, `dtfs__validate_contracts`, `dtfs__explain_contracts`, `dtfs__plan_codegen`, `dtfs__generate_database_schema`, `dtfs__generate_auth_runtime`, `dtfs__generate_backend_api`, `dtfs__generate_frontend_next`, `dtfs__generate_shared_sdk`, `dtfs__generate_tests`, `dtfs__check_generated_project`, `dtfs__typecheck_generated_project`, `dtfs__run_generated_tests`, `dtfs__diff_generated_artifacts`

---

## 5. Claude Agents (`.claude/agents/dtfs-*.md`)

10 agents present:

| Agent | Role |
|-------|------|
| `dtfs-diff-explainer.md` | Explains diffs between ChangeSets |
| `dtfs-platform-mapper.md` | Maps requirements to platform targets |
| `dtfs-product-analyst.md` | Analyzes product descriptions into specs |
| `dtfs-question-manager.md` | Manages open questions lifecycle |
| `dtfs-requirement-extractor.md` | Extracts requirements from specs |
| `dtfs-screen-spec-writer.md` | Writes ScreenSpec artifacts |
| `dtfs-sdd-reviewer.md` | Reviews SDD artifacts |
| `dtfs-sdd-writer.md` | Writes SDD artifacts |
| `dtfs-spec-validator.md` | Validates spec completeness |
| `dtfs-spec-writer.md` | Writes ProductSpec artifacts |

**Agents to add in Phase 27 (none yet):**
`dtfs-runtime-architect`, `dtfs-backend-contract-compiler`, `dtfs-frontend-contract-compiler`, `dtfs-shared-contract-compiler`, `dtfs-hono-api-generator`, `dtfs-better-auth-generator`, `dtfs-next16-generator`, `dtfs-sdk-generator`, `dtfs-codegen-orchestrator`, `dtfs-generated-code-reviewer`

---

## 6. Commands / Skills (`.claude/commands/`)

**Flat commands (`.claude/commands/dtfs-*.md`):** 8 files
- `dtfs-clarify.md`
- `dtfs-extract-requirements.md`
- `dtfs-map-platform.md`
- `dtfs-product-spec.md`
- `dtfs-propose-platform.md`
- `dtfs-screen-spec.md`
- `dtfs-sdd-review.md`
- `dtfs-sdd-write.md`

**Namespaced commands (`.claude/commands/dtfs/`):** 8 files
- `apply.md`
- `describe-app.md`
- `describe-screen.md`
- `generate-spec.md`
- `map-to-platform.md`
- `propose.md`
- `questions.md`
- `revert.md`
- `status.md`
- `validate.md`

**Total: 18 command files.**

**Commands to add in Phase 27 (none yet):**
`/dtfs:set-runtime`, `/dtfs:compile-contracts`, `/dtfs:explain-contracts`, `/dtfs:generate-backend`, `/dtfs:generate-auth`, `/dtfs:generate-frontend`, `/dtfs:generate-sdk`, `/dtfs:generate-app`, `/dtfs:check-generated`, `/dtfs:run-generated-tests`

---

## 7. Codegen (`backend/src/codegen/`)

Files present (9):

| File | Role |
|------|------|
| `codegen.ts` | Main entry point — loads spec, calls emitters, writes files |
| `types.ts` | Shared types: `GeneratedFile`, `ManifestEntry`, `CodegenResult`, `CodegenSpec` |
| `emit-hono.ts` | Emits Hono CRUD route files (one per exposed Resource) |
| `emit-next.ts` | Emits Next.js App Router pages + component stubs (one per Screen) |
| `emit-operations.ts` | Emits typed operation handler stubs |
| `emit-prisma.ts` | Emits `schema.prisma` from Control Plane entities |
| `index.ts` | Public re-export |
| `safe-path.ts` | Sandbox enforcement — no writes outside `/tmp` or `<project>/generated/` |
| `codegen.test.ts` | Codegen tests |

**Current limitation:** emitters read directly from `CodegenSpec` (derived from Prisma via `getSpec()`). They do not pass through `BackendContract` / `FrontendContract` / `SharedContract`. This is the anti-pattern Phase 28 must fix.

---

## 8. Lib Modules

### `backend/src/lib/dsl/` — DSL engines (17 files)

| File | Role |
|------|------|
| `delta-spec.ts` | DeltaSpec Zod schema |
| `expr-ast.ts` | Expr AST + `EXPR_FUNCTIONS` catalog |
| `expr.ts` | Expr main module |
| `expr-analyze.ts` | Expr call analysis |
| `expr-eval.ts` | Expr evaluator |
| `expr-validate.ts` | Expr validator |
| `expr.test.ts` | Expr tests |
| `operation-dsl.ts` | Operation step DSL + `OPERATION_STEP_KINDS` |
| `operation-analyze.ts` | Operation body analyzer |
| `operation-validate.ts` | Operation body validator |
| `operation-dsl.test.ts` | Operation DSL tests |
| `policy-dsl.ts` | Policy rule DSL + `POLICY_RULE_OPS` |
| `policy-eval.ts` | Policy evaluator |
| `policy-validate.ts` | Policy validator |
| `policy.ts` | Policy types |
| `query-config.ts` | Query config DSL |
| `steps.ts` | Step type definitions |

### `backend/src/lib/governance/` — Guardrails (4 files)

| File | Role |
|------|------|
| `audit.ts` | AuditLog writer |
| `governance-check.ts` | Governance rule runner |
| `guardrails.ts` | Guardrail definitions |
| `governance.test.ts` | Governance tests |

### `backend/src/lib/import/` — Design import (5 files)

| File | Role |
|------|------|
| `figma-analyze.ts` | Figma JSON → proposal |
| `html-analyze.ts` | HTML → structured analysis |
| `html-diff.ts` | HTML diff for drift detection |
| `html-to-proposal.ts` | HTML analysis → DeltaSpec proposal |
| `html-import.test.ts` | HTML import tests |

### `backend/src/runtime/` — V3 stubs (3 files)

| File | Role |
|------|------|
| `types.ts` | V3 planned types: `Job`, `Schedule`, `WebhookEndpoint`, `NotificationTemplate`, `SearchIndex`, `Tenant`, `Subscription`, `BillingPlan`, `RuntimeMetric` — type stubs only, no DB |
| `index.ts` | V3 roadmap descriptor + `describeRuntimeRoadmap()` |
| `runtime.test.ts` | Runtime roadmap tests |

### `backend/src/lib/contract/` — Contract assertions (2 files)

| File | Role |
|------|------|
| `assertions.ts` | `assertDeltaSpecContract()`, `assertCoverageContract()` — pure validation helpers |
| `assertions.test.ts` | Contract assertion tests |

**Note:** `lib/contract/` is about pipeline validation assertions (DeltaSpec structural checks), not about `BackendContract`/`FrontendContract`/`SharedContract`. Those three models do not exist yet.

---

## 9. Other Notable Backend Files

| File | Role |
|------|------|
| `backend/src/mcp.ts` | MCP server with 84 tools |
| `backend/src/app.ts` | Hono app definition + `AppType` export |
| `backend/src/server.ts` | Server startup |
| `backend/src/projects.ts` | Project CRUD routes |
| `backend/src/auth.ts` | Better Auth integration |
| `backend/src/changesets.ts` | ChangeSet routes |
| `backend/src/spec.ts` | Spec reading / rendering helpers |
| `backend/src/scaffold.ts` | Project scaffold helpers |
| `backend/src/system.ts` | System utilities |
| `backend/src/versioning.ts` | Revision versioning logic |
| `backend/src/db.ts` | Prisma client singleton |
| `backend/src/concepts/` | 20 concept-layer route files (one per domain) |

---

## 10. Gap List — What the Contracts Addendum Must Add

The table below maps each planned deliverable (Phases 24-29) to its current state.

| Deliverable | Exists? | Location if partial |
|-------------|---------|---------------------|
| `RuntimeTarget` Prisma model | No | — |
| `BackendContract` Prisma model | No | — |
| `FrontendContract` Prisma model | No | — |
| `SharedContract` Prisma model | No | — |
| Migration for above 4 models | No | — |
| `GeneratedArtifact` enriched with contract linkage | Partial | model exists, new fields needed |
| `phase_10_enriched_models` migration applied | No | exists as SQL, not run |
| Docs: `RUNTIME_TARGET.md` | No | — |
| Docs: `BACKEND_CONTRACT.md` | No | — |
| Docs: `FRONTEND_CONTRACT.md` | No | — |
| Docs: `FRONTEND_CONTRACT.md` | No | — |
| Docs: `SHARED_CONTRACT.md` | No | — |
| Docs: `HONO_GENERATION.md` | No | — |
| Docs: `BETTER_AUTH_GENERATION.md` | No | — |
| Docs: `NEXT16_GENERATION.md` | No | — |
| Docs: `SDK_GENERATION.md` | No | — |
| Docs: `GENERATED_ARTIFACTS.md` | No | — |
| `compileBackendContract()` function | No | — |
| `compileFrontendContract()` function | No | — |
| `compileSharedContract()` function | No | — |
| `validateContracts()` function | No | — |
| MCP tools: `dtfs__get/set_runtime_target` | No | — |
| MCP tools: `dtfs__compile_*_contract` (3) | No | — |
| MCP tools: `dtfs__validate_contracts` | No | — |
| MCP tools: `dtfs__explain_contracts` | No | — |
| MCP tools: codegen tools (7) | No | — |
| MCP tools: verify tools (4) | No | — |
| Agents: dtfs-runtime-architect | No | — |
| Agents: dtfs-backend-contract-compiler | No | — |
| Agents: dtfs-frontend-contract-compiler | No | — |
| Agents: dtfs-shared-contract-compiler | No | — |
| Agents: dtfs-hono-api-generator | No | — |
| Agents: dtfs-better-auth-generator | No | — |
| Agents: dtfs-next16-generator | No | — |
| Agents: dtfs-sdk-generator | No | — |
| Agents: dtfs-codegen-orchestrator | No | — |
| Agents: dtfs-generated-code-reviewer | No | — |
| Commands: `/dtfs:set-runtime` through `/dtfs:run-generated-tests` (10) | No | — |
| Codegen emitters: pass through contracts (not direct spec) | Partial | existing emitters read spec directly |

**What exists that is safe to build on:**
- `CodegenSpec` type (used by all current emitters) → will be superseded by contract types but can remain for backward compat
- `GeneratedArtifact` model (exists, needs enrichment)
- `lib/contract/assertions.ts` (pipeline validation — different concern, not contracts)
- `runtime/types.ts` (V3 stubs — different concern)
- `emit-hono.ts`, `emit-next.ts`, `emit-prisma.ts`, `emit-operations.ts` (will be adapted, not replaced)
