# Documentation Build Report

Build date: 2026-05-24 (vault) / 2026-05-25 (Home refinement + this report).

---

## Files created

| Folder | Files | Notes |
|---|---|---|
| `00_Home/` | 4 | README, MAP_OF_CONTENT, AI_INDEX, GLOSSARY |
| `01_Product/` | 7 | PRODUCT_VISION, PRODUCT_SPEC, PERSONAS, USER_JOURNEYS, REQUIREMENTS, ASSUMPTIONS, OPEN_QUESTIONS |
| `02_Architecture/` | 7 | ARCHITECTURE_OVERVIEW, EXECUTION_FLOW, CONTROL_PLANE, CLIENT_APP_RUNTIME, DATA_OWNERSHIP, SECURITY_MODEL, SEPARATION_OF_CONCERNS |
| `03_Control_Plane/` | 9 | CONTROL_PLANE_MODEL, DELTA_SPEC, CHANGESET_REVISION, PROJECT_SPEC, SPEC_KIT_INTEGRATION, BEHAVIOR_EXPANSION, EXPR_DSL, OPERATION_DSL, POLICY_DSL |
| `04_Runtime_Contracts/` | 5 | BACKEND_CONTRACT, FRONTEND_CONTRACT, SHARED_CONTRACT, CONTRACT_COMPILATION, CONTRACT_VALIDATION, CONTRACT_TO_CODEGEN_MAPPING (6 total) |
| `05_Generated_App/` | 9 | GENERATED_APP_OVERVIEW, GENERATED_ARTIFACTS, HONO_API_GENERATION, BETTER_AUTH_GENERATION, NEXT16_GENERATION, SHARED_SDK_GENERATION, DATABASE_GENERATION, CLIENT_DATABASE, CLIENT_APP_DOCKER_RUNTIME |
| `06_API/` | 3 md + 2 yaml | CONTROL_PLANE_API, GENERATED_CLIENT_API, OPENAPI_GUIDELINES + 2 OpenAPI files |
| `07_Schemas/` | 3 md + 8 json | SCHEMA_GUIDELINES, JSON_SCHEMA_GUIDELINES, ZOD_GUIDELINES + 8 JSON Schema files |
| `08_Diagrams/` | 1 README + 6 excalidraw pairs + 7 mermaid | See Diagrams section |
| `09_ADR/` | 1 README + 10 ADRs | ADR-0001 through ADR-0010 |
| `10_Agents_MCP_Skills/` | 6 | AGENTS_OVERVIEW, AGENT_RESPONSIBILITIES, MCP_TOOLS, SKILLS_AND_COMMANDS, HOOKS, SAFETY_RULES |
| `11_Testing/` | 6 | TEST_STRATEGY, CONTRACT_TESTS, GOLDEN_TESTS, LLM_OUTPUT_TESTS, GENERATED_APP_TESTS, SECURITY_TESTS |
| `12_Operations/` | 7 | LOCAL_DEV, DOCKER, MIGRATIONS, DEPLOYMENT_TARGETS, RUNTIME_INSTANCES, CLIENT_APP_START_STOP, TROUBLESHOOTING |
| `13_AI_Context/` | 6 md + 5 prompts | AI_PROJECT_BRIEF, AI_INDEX (vault copy), AI_RULES, AI_DO_NOT_BREAK, AI_NAVIGATION_GUIDE, AI_GENERATION_CHECKLIST + 5 prompt files |
| `assets/` | 2 | .gitkeep placeholders (images/, exports/) |
| Root | 2 | README.md (vault root), BUILD_REPORT.md (this file) |

**Total: ~127 files** (123 content files + 2 asset placeholders + .gitignore + this report).

---

## Files updated

The following files were refined after initial build (2026-05-25):

| File | Change |
|---|---|
| `00_Home/README.md` | Full rewrite: pitch, main entry table, BUILD_REPORT link |
| `00_Home/MAP_OF_CONTENT.md` | Full rewrite: complete links to all real pages, removed all _(stub)_ markers |
| `00_Home/AI_INDEX.md` | Full rewrite: 4-section structure (start, read-before-modify, rules, source-of-truth) |
| `00_Home/GLOSSARY.md` | Full rewrite: 30 terms (was 25), added links to vault pages, removed trailing status block |

---

## Missing information

The following areas remain incomplete or require deeper content:

| Area | Gap | Priority |
|---|---|---|
| OpenAPI specs | `control-plane.openapi.yaml` and `generated-client-api.openapi.yaml` are structural placeholders — route coverage is partial | P1 |
| JSON Schema files | All 8 `.schema.json` files are structural placeholders — field-level completeness not audited | P1 |
| `05_Generated_App/CLIENT_APP_DOCKER_RUNTIME.md` | Docker compose spec is not yet real (Docker runtime not implemented) | P1 |
| `12_Operations/RUNTIME_INSTANCES.md` | RuntimeInstance lifecycle documented as target, not implemented | P1 |
| `13_AI_Context/AI_GENERATION_CHECKLIST.md` | Pre-generation checklist exists but not cross-referenced with current guardrail gaps | P2 |
| `08_Diagrams/excalidraw/` | Excalidraw files contain valid JSON structure; visual content was generated from description — needs human review in Excalidraw app | P2 |
| `11_Testing/GOLDEN_TESTS.md` | Only 2 of 6 planned golden tests exist in the codebase | P2 |
| `03_Control_Plane/BEHAVIOR_EXPANSION.md` | Behavior→OperationStep expansion not yet implemented | P2 |
| `docs/HARNESS_DEV.md` | Referenced in audit but does not exist | P2 |

---

## Diagrams created

### Excalidraw (6 diagrams)

| File | Topic |
|---|---|
| `excalidraw/00-global-architecture.excalidraw` | Two-plane global architecture |
| `excalidraw/01-control-plane-vs-client-runtime.excalidraw` | Control Plane vs Client Runtime separation |
| `excalidraw/02-natural-language-to-codegen.excalidraw` | NL input → spec → contracts → codegen |
| `excalidraw/03-contract-compilation.excalidraw` | Contract compilation pipeline |
| `excalidraw/04-docker-runtime-client-app.excalidraw` | Docker runtime for Client App (target state) |
| `excalidraw/05-change-set-reversibility.excalidraw` | ChangeSet/Revision reversibility |

Each excalidraw file has a companion `.md` description file.

### Mermaid (7 diagrams)

| File | Topic |
|---|---|
| `mermaid/00-global-flow.md` | End-to-end global flow |
| `mermaid/01-natural-spec-flow.md` | Natural language → ProductSpec → ScreenSpec |
| `mermaid/02-delta-spec-flow.md` | DeltaSpec validate → apply → ChangeSet |
| `mermaid/03-contract-compilation-flow.md` | Contract compilation pipeline |
| `mermaid/04-codegen-flow.md` | Codegen + emitter pipeline |
| `mermaid/05-client-runtime-flow.md` | Client App Docker runtime flow |
| `mermaid/06-mcp-agent-flow.md` | MCP tool + agent interaction |

---

## Schemas created

| File | Covers |
|---|---|
| `schemas/product-spec.schema.json` | ProductSpec model |
| `schemas/screen-spec.schema.json` | ScreenSpec model |
| `schemas/delta-spec.schema.json` | DeltaSpec 21-bucket format |
| `schemas/backend-contract.schema.json` | BackendContract compiled output |
| `schemas/frontend-contract.schema.json` | FrontendContract compiled output |
| `schemas/shared-contract.schema.json` | SharedContract compiled output |
| `schemas/generated-artifact.schema.json` | GeneratedArtifact tracking record |
| `schemas/runtime-target.schema.json` | RuntimeTarget configuration |

All 8 files are structural placeholders — field-level completeness should be audited against `backend/prisma/schema.prisma` and the Zod types in `backend/src/lib/dsl/delta-spec.ts`.

---

## OpenAPI files created

| File | Covers |
|---|---|
| `openapi/control-plane.openapi.yaml` | Control Plane HTTP API (Hono routes) |
| `openapi/generated-client-api.openapi.yaml` | Shape of a generated Client App API |

Both files are structural; route-level completeness should be cross-checked against `backend/src/app.ts` and `docs/HTTP_API.md`.

---

## ADRs created

| ADR | Decision |
|---|---|
| ADR-0001 | Use a Control Plane with formal spec model |
| ADR-0002 | Use DeltaSpec (21 buckets) instead of freeform mutations |
| ADR-0003 | Use ChangeSet/Revision for reversibility |
| ADR-0004 | Separate Control Plane and Client Runtime |
| ADR-0005 | Use Hono for generated APIs |
| ADR-0006 | Use better-auth for generated app authentication |
| ADR-0007 | Use Next.js 16 (App Router) for generated frontend |
| ADR-0008 | Compile contracts before emitting code |
| ADR-0009 | Use Obsidian vault for AI-readable documentation |
| ADR-0010 | Use OpenAPI + JSON Schema + Zod triad |

---

## AI context created

| File | Purpose |
|---|---|
| `AI_PROJECT_BRIEF.md` | One-page brief for any AI agent starting work on DTFS |
| `AI_RULES.md` | Hard rules: pipeline discipline, schema separation, DSL constraints |
| `AI_DO_NOT_BREAK.md` | P0/P1 items that must never regress (guardrails, protected flag, contracts gate) |
| `AI_NAVIGATION_GUIDE.md` | How to navigate the vault: which file to read for which task |
| `AI_GENERATION_CHECKLIST.md` | Pre-generation checklist: validate spec → validate contracts → check guardrails → generate |
| `AI_PROMPTS/add-runtime-contracts.md` | Prompt template: add runtime contracts to a project |
| `AI_PROMPTS/audit.md` | Prompt template: architecture audit |
| `AI_PROMPTS/generate-client-app.md` | Prompt template: full client app generation |
| `AI_PROMPTS/generate-docs.md` | Prompt template: documentation generation |
| `AI_PROMPTS/verify-architecture.md` | Prompt template: architecture conformance check |

---

## Phase 21 — Status table

| Area | Status | Notes |
|---|---|---|
| Product docs | ✅ | PRODUCT_VISION, PRODUCT_SPEC, PERSONAS, USER_JOURNEYS, REQUIREMENTS, ASSUMPTIONS, OPEN_QUESTIONS all created and non-empty |
| Architecture docs | ✅ | 7 files covering two-plane model, execution flow, security, data ownership |
| Control Plane docs | ✅ | 9 files covering all models, 3 DSLs, ChangeSet/Revision, SpecKit |
| Runtime contracts | ✅ | 6 files; compilation documented; validation gate documented as P1 gap |
| Generated app docs | ⚠️ | 9 files; Docker runtime and RuntimeInstance documented as target (not implemented) |
| OpenAPI | ⚠️ | 2 files created; structural placeholders — route coverage partial |
| JSON Schema / Zod | ⚠️ | 8 schema files created; structural placeholders — field completeness not verified |
| Diagrams | ✅ | 6 Excalidraw + 7 Mermaid created; Excalidraw needs human review in app |
| ADR | ✅ | 10 ADRs covering all major architectural decisions |
| AI context | ✅ | 6 AI context files + 5 prompt templates created |

---

## Implementation reality

Based on `docs/AUDIT_REPORT.md` (read-only audit, 2026-05-25, score ~78%).

| Domain | Documented | Partially implemented | Implemented | Tested |
|---|---|---|---|---|
| Prisma schema (43 models) | ✅ | | ✅ | ✅ (`prisma validate` OK) |
| Expr / Operation / Policy DSLs | ✅ | | ✅ | ✅ (330 tests green) |
| DeltaSpec format (21 buckets) | ✅ | | ✅ | ✅ |
| DeltaSpec apply (21 buckets) | ✅ | ⚠️ 9/21 not_implemented_yet | 12/21 | partial |
| ChangeSet / Revision | ✅ | | ✅ | ✅ |
| SpecKit (NL artifacts) | ✅ | | ✅ | ✅ |
| Contract compilation (3 contracts) | ✅ | | ✅ | ✅ (2 golden tests) |
| Codegen — backend (Hono, auth) | ✅ | ⚠️ Asset absent; policy middleware = stub | 4/8 mappings complete | partial |
| Codegen — frontend (Next.js 16) | ✅ | ⚠️ forms/actions/dataBindings compiled but not emitted | 1/8 mappings complete | minimal |
| MCP tools (102) | ✅ | | ✅ (39 canonical + extras) | ✅ |
| Agents (19) | ✅ | | ✅ | n/a |
| Guard: validate-before-apply | ✅ | | ⚠️ implemented as separate tool, NOT enforced in apply path | ❌ not blocking |
| Guard: contracts gate | ✅ | | ⚠️ implemented as separate tool, NOT enforced in generateApp | ❌ not blocking |
| Guard: protect manual files | ✅ | | ❌ `protected` hardcoded `false` | ❌ never triggers |
| Docker client runtime | ✅ (documented as target) | | ❌ not implemented | ❌ |
| Hooks (4 defined) | ✅ | | ⚠️ 2/4 active (PreToolUse guard-apply, Stop audit); 2/4 scripted but not registered | partial |

---

## Prochaines etapes

1. **Patch P0 guardrails** (see `docs/AUDIT_REPORT.md` Plan de patch, Step 1): enforce `validateDeltaSpec` inside `applyDeltaSpec`; make `protected` flag real in `codegen.ts`. These are the highest-risk gaps — false-confidence bugs.

2. **Complete OpenAPI and JSON Schema placeholders**: cross-check `openapi/control-plane.openapi.yaml` against `backend/src/app.ts`; align 8 `.schema.json` files with the Zod types in `backend/src/lib/dsl/delta-spec.ts` and `backend/prisma/schema.prisma`.

3. **Enrich Excalidraw diagrams**: open each `.excalidraw` file in the Obsidian Excalidraw plugin or excalidraw.com and review/extend the visual content beyond the generated JSON skeleton.

4. **Implement codegen frontend** (AUDIT_REPORT Plan Step 3): `emit-next.ts` must consume `contract.forms`, `contract.actions`, `contract.dataBindings`; add Asset mapping; compile PolicyRule → real middleware.

5. **Complete DeltaSpec apply** (AUDIT_REPORT Plan Step 4): implement the 9 `not_implemented_yet` buckets; wrap in `$transaction`.
