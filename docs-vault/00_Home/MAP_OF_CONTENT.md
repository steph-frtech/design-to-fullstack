# Map of Content

Central index of all vault pages. Sections mirror the execution pipeline and the two-plane architecture.

---

## Start here

- [[README]] — Home pitch and main entry points
- [[ARCHITECTURE_OVERVIEW]] — Two-plane model, 10-layer pipeline summary
- [[EXECUTION_FLOW]] — Concrete walkthrough: prompt → deployable app
- [[GLOSSARY]] — Canonical term definitions
- [[AI_INDEX]] — Where AI agents should start

---

## Product (`01_Product/`)

- [[PRODUCT_VISION]] — Platform vision, positioning, value proposition
- [[PRODUCT_SPEC]] — ProductSpec model, extraction from NL input
- [[PERSONAS]] — User archetypes (Builder, Power User, Reviewer, Operator)
- [[USER_JOURNEYS]] — End-to-end user flows per persona
- [[REQUIREMENTS]] — Requirement, RequirementMapping, PlatformSpecProposal
- [[ASSUMPTIONS]] — Documented assumptions and their risk level
- [[OPEN_QUESTIONS]] — Open questions requiring decisions

---

## Architecture (`02_Architecture/`)

- [[ARCHITECTURE_OVERVIEW]] — Two-plane model, 10-layer pipeline summary
- [[EXECUTION_FLOW]] — Full chain: NL → ProductSpec → DeltaSpec → Contracts → Codegen
- [[CONTROL_PLANE]] — Overview of the Control Plane (schema `dtfs`)
- [[CLIENT_APP_RUNTIME]] — Client App runtime model and Docker target
- [[DATA_OWNERSHIP]] — Schema separation: `dtfs` vs `gen_<slug>`
- [[SECURITY_MODEL]] — Auth, isolation, policy enforcement
- [[SEPARATION_OF_CONCERNS]] — What lives where and why

---

## Control Plane (`03_Control_Plane/`)

- [[CONTROL_PLANE_MODEL]] — Full Prisma model inventory (43 models)
- [[DELTA_SPEC]] — DeltaSpec format, 21 buckets, validate/apply/explain
- [[CHANGESET_REVISION]] — ChangeSet lifecycle, Revision history, revert
- [[PROJECT_SPEC]] — Project and spec model overview
- [[SPEC_KIT_INTEGRATION]] — SpecKit: natural-language artifacts sync to disk
- [[BEHAVIOR_EXPANSION]] — Behavior model and DSL expansion

### DSLs

- [[EXPR_DSL]] — Expr AST: 5 variants, 8 closed functions, 8 roots
- [[OPERATION_DSL]] — 10 OperationStep kinds
- [[POLICY_DSL]] — 12 PolicyOp kinds, evaluation via Expr

---

## Runtime Contracts (`04_Runtime_Contracts/`)

- [[BACKEND_CONTRACT]] — BackendContract compilation: entities, resources, operations, auth, policies
- [[FRONTEND_CONTRACT]] — FrontendContract compilation: screens, forms, fields, actions, dataBindings
- [[SHARED_CONTRACT]] — SharedContract: shared types, enums, zod schemas
- [[CONTRACT_COMPILATION]] — How the three contracts are compiled from the spec
- [[CONTRACT_VALIDATION]] — validateContracts gate (P1: not yet enforced in pipeline)
- [[CONTRACT_TO_CODEGEN_MAPPING]] — Mapping: contract fields → emitter inputs

---

## Generated App (`05_Generated_App/`)

- [[GENERATED_APP_OVERVIEW]] — Output arborescence: apps/api + apps/web + packages/shared
- [[GENERATED_ARTIFACTS]] — GeneratedArtifact tracking, contentHash, protection flag
- [[HONO_API_GENERATION]] — emit-hono.ts: routes, middleware, guards
- [[BETTER_AUTH_GENERATION]] — emit-auth.ts: auth handlers
- [[NEXT16_GENERATION]] — emit-next.ts: pages, forms (currently stub)
- [[SHARED_SDK_GENERATION]] — emit-sdk.ts: typed client SDK
- [[DATABASE_GENERATION]] — emit-prisma.ts: schema generation for Client App DB
- [[CLIENT_DATABASE]] — Client App DB: schema `gen_<slug>`, migration at boot
- [[CLIENT_APP_DOCKER_RUNTIME]] — Docker compose, migration at boot, runtime lifecycle

---

## API (`06_API/`)

- [[CONTROL_PLANE_API]] — HTTP API for the Control Plane (Hono routes)
- [[GENERATED_CLIENT_API]] — HTTP API shape of a generated Client App
- [[OPENAPI_GUIDELINES]] — How OpenAPI specs are structured and maintained

### OpenAPI files

- `06_API/openapi/control-plane.openapi.yaml` — Control Plane API spec
- `06_API/openapi/generated-client-api.openapi.yaml` — Generated Client API spec

---

## Schemas (`07_Schemas/`)

- [[SCHEMA_GUIDELINES]] — When and how to use JSON Schema vs Zod
- [[JSON_SCHEMA_GUIDELINES]] — JSON Schema authoring rules
- [[ZOD_GUIDELINES]] — Zod schema authoring and reuse rules

### JSON Schema files

- `07_Schemas/schemas/product-spec.schema.json`
- `07_Schemas/schemas/screen-spec.schema.json` (also ScreenSpec)
- `07_Schemas/schemas/delta-spec.schema.json`
- `07_Schemas/schemas/backend-contract.schema.json`
- `07_Schemas/schemas/frontend-contract.schema.json`
- `07_Schemas/schemas/shared-contract.schema.json`
- `07_Schemas/schemas/generated-artifact.schema.json`
- `07_Schemas/schemas/runtime-target.schema.json`

---

## Diagrams (`08_Diagrams/`)

- [[08_Diagrams/README]] — Index of all diagrams

### Excalidraw diagrams

- [[excalidraw/00-global-architecture]] — Global two-plane architecture
- [[excalidraw/01-control-plane-vs-client-runtime]] — Control Plane vs Client Runtime separation
- [[excalidraw/02-natural-language-to-codegen]] — NL input → codegen pipeline
- [[excalidraw/03-contract-compilation]] — Contract compilation flow
- [[excalidraw/04-docker-runtime-client-app]] — Docker runtime for Client App
- [[excalidraw/05-change-set-reversibility]] — ChangeSet/Revision reversibility model

### Mermaid diagrams

- [[mermaid/00-global-flow]] — End-to-end global flow
- [[mermaid/01-natural-spec-flow]] — Natural language → spec flow
- [[mermaid/02-delta-spec-flow]] — DeltaSpec validate/apply flow
- [[mermaid/03-contract-compilation-flow]] — Contract compilation pipeline
- [[mermaid/04-codegen-flow]] — Codegen + emitter flow
- [[mermaid/05-client-runtime-flow]] — Client App runtime flow
- [[mermaid/06-mcp-agent-flow]] — MCP tool + agent interaction flow

---

## ADR (`09_ADR/`)

- [[09_ADR/README]] — ADR index and format
- [[ADR-0001-use-control-plane]] — Why a Control Plane with a formal spec model
- [[ADR-0002-use-deltaspec]] — Why DeltaSpec (21 buckets) instead of freeform mutations
- [[ADR-0003-use-changesets]] — Why ChangeSet/Revision for reversibility
- [[ADR-0004-separate-control-plane-and-client-runtime]] — Two-plane separation rationale
- [[ADR-0005-use-hono-for-generated-api]] — Why Hono for generated APIs
- [[ADR-0006-use-better-auth]] — Why better-auth for generated app authentication
- [[ADR-0007-use-next16]] — Why Next.js 16 (App Router) for generated frontend
- [[ADR-0008-use-contract-compilation-before-codegen]] — Why compile contracts before emitting code
- [[ADR-0009-use-obsidian-as-ai-readable-docs]] — Why Obsidian vault for AI-readable documentation
- [[ADR-0010-use-openapi-jsonschema-zod]] — Why OpenAPI + JSON Schema + Zod triad

---

## Agents, MCP & Skills (`10_Agents_MCP_Skills/`)

- [[AGENTS_OVERVIEW]] — 19 agents overview and responsibilities
- [[AGENT_RESPONSIBILITIES]] — Per-agent task scope and tool access
- [[MCP_TOOLS]] — 102 MCP tools (39 canonical + extras), by category
- [[SKILLS_AND_COMMANDS]] — 20 slash commands and skill files
- [[HOOKS]] — PreToolUse / PostToolUse / Stop hooks registered
- [[SAFETY_RULES]] — Agent safety rules and guardrail responsibilities

---

## Testing (`11_Testing/`)

- [[TEST_STRATEGY]] — Test categories, coverage targets, test runner
- [[CONTRACT_TESTS]] — Tests for contract compilation and validation
- [[GOLDEN_TESTS]] — Golden tests for pipeline stages
- [[LLM_OUTPUT_TESTS]] — Testing LLM-generated spec artifacts
- [[GENERATED_APP_TESTS]] — Tests for generated app correctness
- [[SECURITY_TESTS]] — Security-focused tests (guardrails, injection)

---

## Operations (`12_Operations/`)

- [[LOCAL_DEV]] — Local dev setup, pnpm commands, env vars
- [[DOCKER]] — Docker setup for Control Plane and Client Apps
- [[MIGRATIONS]] — Prisma migration workflow
- [[DEPLOYMENT_TARGETS]] — Supported deployment targets
- [[RUNTIME_INSTANCES]] — RuntimeInstance model and lifecycle
- [[CLIENT_APP_START_STOP]] — Start/stop a Client App Docker container
- [[TROUBLESHOOTING]] — Common issues and diagnostics

---

## AI Context (`13_AI_Context/`)

- [[AI_PROJECT_BRIEF]] — One-page brief for AI agents: what DTFS is, key constraints
- [[AI_INDEX]] — Entry point: where to start, what to read, rules never to break
- [[AI_RULES]] — Hard rules: no prompt-to-code, schema separation, guard enforcement
- [[AI_DO_NOT_BREAK]] — P0/P1 items that must never regress
- [[AI_NAVIGATION_GUIDE]] — How to navigate the vault efficiently
- [[AI_GENERATION_CHECKLIST]] — Pre-generation checklist for AI agents

### AI Prompts (`13_AI_Context/AI_PROMPTS/`)

- `AI_PROMPTS/add-runtime-contracts.md`
- `AI_PROMPTS/audit.md`
- `AI_PROMPTS/generate-client-app.md`
- `AI_PROMPTS/generate-docs.md`
- `AI_PROMPTS/verify-architecture.md`

---

## Build report

- [[BUILD_REPORT]] — Documentation build report: files created, gaps, implementation reality
