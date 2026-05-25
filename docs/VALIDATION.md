# VALIDATION — Final Validation Report (Phase 29)

Date: 2026-05-25
Pipeline phases validated: 0 → 29

---

## 1. Environment Validation

### 1.1 Full Typecheck

```
pnpm typecheck   # runs tsc --noEmit on backend + frontend/web
Result: 0 errors (backend + frontend/web, 2 workspaces)
```

### 1.2 Backend Test Suite

```
cd backend && TEST_PROJECT_ID=cmpji9ev90001m5p05krcodcg pnpm test
Result: 330 pass / 0 fail / 0 skip
```

Previous baseline (before Phase 29 addendum): 320 pass.
The +10 come from the new `contracts-codegen.e2e.test.ts` (see Section 4).

### 1.3 Prisma Schema Validation

```
cd backend && pnpm exec prisma validate
Result: schema valid
```

### 1.4 MCP Tools Registration

```
cd backend && pnpm exec tsx scripts/mcp-list-tools.ts
Result: 102 tools registered, all MVP tools present
```

Contracts + codegen tools confirmed present:
- `dtfs__compile_backend_contract`
- `dtfs__compile_frontend_contract`
- `dtfs__compile_shared_contract`
- `dtfs__validate_contracts`
- `dtfs__explain_contracts`
- `dtfs__get_runtime_target`
- `dtfs__set_runtime_target`
- `dtfs__plan_codegen`
- `dtfs__generate_app`
- `dtfs__generate_database_schema`
- `dtfs__generate_shared_sdk`
- `dtfs__generate_auth_runtime`
- `dtfs__generate_backend_api`
- `dtfs__generate_frontend_next`
- `dtfs__generate_tests`
- `dtfs__check_generated_project`
- `dtfs__typecheck_generated_project`
- `dtfs__run_generated_tests`
- `dtfs__diff_generated_artifacts`

---

## 2. Contracts Pipeline (Phases 22–26)

### 2.1 BackendContract

`compileBackendContract(projectId)` reads Entity/Resource/Operation/Policy/AuthMethod from
the DB and returns a `BackendContractObj` in memory. Tested against:
- `cmpji9ev90001m5p05krcodcg` (3 entities, TodoList/TodoItem/ShareLink)
- Ephemeral project `__test_cg29_*` (Article + Comment, 2 resources, 1 screen, 1 operation)

Result: routes non-empty when resources exist, schemas count == entity count.

### 2.2 FrontendContract

`compileFrontendContract(projectId)` reads Screen/Component/Form/Field/Action/DataBinding.
Phase-10 columns (`sourceKind`, `componentFkId`, `actionKind`, etc.) are guarded with
`select: { ... }` — only base columns queried (migration gate pattern).

Result: pages count == screens count, Next.js routes are correctly formatted.

### 2.3 SharedContract

`compileSharedContract(projectId)` produces entity DTOs, Zod schemas, operation types,
AuthSession, error codes, events, and typed API client manifest.

Result: Zod schema exists for every entity type, 6 standard error codes always present.

### 2.4 Cross-Contract Validation

`validateContracts(projectId)` runs 7 coherence checks across the three contracts.
Test project result: `ok=true` or `ok=false` with structured error codes (no crash).

---

## 3. Codegen Pipeline (Phases 27–28)

### 3.1 Layer Order

```
database → shared → auth → backend → frontend → sdk → tests
```

`planCodegen` returns this exact order with file-count estimates per layer.

### 3.2 Generated Arborescence

Contract-driven `generateApp` writes to the new monorepo layout:
```
prisma/schema.prisma
apps/api/src/index.ts
apps/api/src/routes/<resource>.ts      (one per resource)
apps/api/src/repositories/<E>.repository.ts
apps/api/src/auth.ts
apps/web/app/**/*.tsx                  (one page per screen)
apps/web/app/layout.tsx
apps/web/lib/api/client.ts
packages/shared/src/schemas/index.ts
packages/shared/src/types/index.ts
packages/shared/src/errors.ts
packages/shared/src/api-contract.ts
packages/shared/src/index.ts
packages/shared/src/sdk/client.ts
packages/shared/src/sdk/index.ts
tests/api/*.test.ts
tests/contract/contracts.test.ts
tests/e2e/smoke.test.ts
```

### 3.3 Safe-Path Enforcement

`resolveSafeOutDir` blocks writes into the meta-platform repo (`/data/dev/design-to-fullstack`).
Only `/tmp/*` and `<localPath>/generated/*` are allowed. Tested with 10+ edge cases.

### 3.4 Dry-Run Guarantee

`generateApp(id, { dryRun: true })` never creates any file or directory on disk.
Verified by `fs.existsSync(outDir)` assertions in both unit and e2e tests.

### 3.5 Manifest + ContentHash

`generateApp(id, { dryRun: false, outDir })` writes `.dtfs-manifest.json` with:
- `projectId`, `generatedAt`, `outDir`, `layer`
- per-file entries: `path`, `contentHash` (SHA-256 hex, 64 chars), `bytes`, `protected`

### 3.6 Protected File Detection

`checkGeneratedProject(outDir)` reads the manifest and reports any file with `protected:true`
as an issue. No overwrite is performed — detection only. V2 will implement write-guard.

---

## 4. Phase 29 e2e Addendum

File: `backend/src/test/e2e/contracts-codegen.e2e.test.ts`

| Test key | Assertion | Result |
|----------|-----------|--------|
| ProjectSpec → BackendContract OK | routes non-empty, schemas == entities, op route present | PASS |
| ProjectSpec → FrontendContract OK | pages == screens, nextRoute format correct | PASS |
| ProjectSpec → SharedContract OK | entity types, Zod schemas, AuthSession, 6 errors, op input type | PASS |
| Contracts → Hono API OK | apps/api/ in dryRun manifest | PASS |
| Contracts → Next frontend OK | apps/web/ in dryRun manifest | PASS |
| Contracts → SDK typed OK | packages/shared/ in dryRun manifest | PASS |
| GeneratedArtifacts bien créés | dryRun=false → .dtfs-manifest.json + 64-char hashes per file | PASS |
| Aucun fichier manuel écrasé | protected=true detected, ok=false, no write performed | PASS |

Anti-pollution: ephemeral project `__test_cg29_<ts>` deleted in `after()` try/finally.
All `/tmp/dtfs-e2e-*` directories cleaned in teardown.
Principal project `cmpji9ev90001m5p05krcodcg` remains untouched (entities=3 verified).

---

## 5. Migrations Pending Gate (human approval required)

Two migrations were prepared but NOT applied to the live database:

| Migration | Description | Gate |
|-----------|-------------|------|
| `20260524110000_phase_10_enriched_models` | Adds columns to Action, DataBinding, AppRole, EventDefinition, Screen (titleKey, type) | Human gate: review breaking changes |
| `20260524120000_control_plane_v1_3_runtime_contracts` | Creates `RuntimeTarget` table (phase 25) and `CompileContract` table (phase 26) | Human gate: review scope |

Both are guarded in the application code with graceful fallbacks:
- `getRuntimeTarget` / `setRuntimeTarget` catch `P2021` and return `source:"default"` or `{ok:false, error:"runtime_target_table_not_migrated"}` — never crash.
- `compileFrontendContract` and `compileSharedContract` use explicit `select:{}` to avoid querying phase-10 columns.

---

## 6. Known V1 Limits / V2 Backlog

| Item | V1 status | V2 plan |
|------|-----------|---------|
| `runGeneratedTests` | Stub — always returns `skipped:true` | V2: execute generated tests via child_process |
| `typecheckGeneratedProject` | Runs `tsc --noEmit` if tsconfig.json present; generated project has no tsconfig yet | V2: emit tsconfig.json in generateApp |
| Write-guard for protected files | Detection only (checkGeneratedProject reports issue) | V2: skip writing protected files during regeneration |
| Phase-10 columns (Action.actionKind, DataBinding.sourceKind, etc.) | Not queried (select guard) | V2: apply migration, extend compile-frontend |
| RuntimeTarget table | Not migrated; getRuntimeTarget returns DEFAULT | V2: apply migration 20260524120000, enable full set/get |
| Figma live import | Stub analyzer (no live API call) | V2: integrate Figma API key |
| Operation steps execution | Stubs in generated handlers | V2: emit real Prisma calls from operation DSL |
| Generated tests | Stubs (kind=TEST, node:test format) | V2: make runnable |

---

## 7. Pipeline Status 0 → 29

| Phase range | Scope | Status |
|-------------|-------|--------|
| 0–3 | Foundation: Prisma schema, Hono skeleton, better-auth, initial migrations | DONE |
| 4–9 | Spec model: Entity, Resource, Operation, Policy, Screen, ChangeSet, Revision | DONE |
| 10 | Enriched models (Action, DataBinding, AppRole, EventDefinition) | SCHEMA ONLY — migration gated |
| 11–15 | DSL: Expr, OperationDSL, PolicyDSL, DeltaSpec, compileProposalToDelta | DONE |
| 16–18 | Codegen V1: emitPrisma, emitHono, emitNext, safe-path, generateApp legacy | DONE |
| 19–21 | Governance, audit, guardrails, behavior expansion | DONE |
| 22–25 | RuntimeTarget, contracts spec, compile-backend/frontend/shared | DONE |
| 26 | validate-contracts, explain-contracts, runtime-target graceful fallback | DONE |
| 27–28 | Contract-driven codegen: emitShared, emitAuth, emitHono (new arbo), emitNext, emitSdk, emitTests, granular generators, diff/check/typecheck tools | DONE |
| 29 | Final validation, e2e addendum, STATUS.md update, this document | DONE |

**Global pipeline status: FUNCTIONAL end-to-end (phases 0–29), 2 migrations pending human gate.**
