# CODEGEN — Contract-Driven Code Generation (Phase 28)

This document describes the `backend/src/codegen/` module.
Phase 17 introduced the MVP (direct spec); **Phase 28 made it contract-driven by default**.

## Overview

The codegen pass reads the **Control Plane spec** of a project (Entities, Relations,
Resources, Operations, Screens) and emits a skeleton full-stack application
(Hono backend + Prisma schema + Next.js frontend) in a sandboxed output directory.

The generation is **deterministic**: same spec + same codegen version = byte-identical output.
It is **not a running app**: the generated code is well-formed stubs, not a production
implementation. The goal is traceability and a verifiable baseline, not execution.

---

## Architecture — Emitters (Phase 28)

All source lives in `backend/src/codegen/`.

```
codegen/
  index.ts                barrel re-export
  types.ts                shared types (CodegenSpec, GeneratedFile, ManifestEntry, CodegenResult)
  safe-path.ts            sandbox guard — resolveSafeOutDir()
  emit-prisma.ts          Prisma schema (from CodegenSpec.entities — no contract needed)
  emit-hono.ts            Hono routes: emitHonoRoutes (legacy) + emitHonoBackendApi (contract-driven)
  emit-operations.ts      Operation handler stubs (legacy)
  emit-next.ts            Next.js pages: emitNextPages (legacy) + emitNextFrontend (contract-driven)
  emit-shared.ts          [NEW] packages/shared from SharedContract
  emit-auth.ts            [NEW] apps/api/src/auth.ts from BackendContract.auth
  emit-sdk.ts             [NEW] packages/shared/src/sdk from SharedContract
  emit-tests.ts           [NEW] tests/{api,e2e,contract} stubs from BackendContract + SharedContract
  codegen.ts              orchestrator + granular functions + verify tools
  codegen.test.ts         Phase 17 unit tests (28 tests)
  codegen-contracts.test.ts  [NEW] Phase 28 contract-driven tests (45 tests)
```

### Contract-driven flow (Phase 28 default)

```
spec → compileBackendContract + compileFrontendContract + compileSharedContract
     → emitters consume contracts (not raw spec)
     → GeneratedFile[] in new arborescence
```

Order: **database → shared → auth → backend → frontend → sdk → tests**

### Entry points

```ts
// Main entry — contract-driven, generates all layers by default
generateApp(projectId: string, opts?: CodegenOptions): Promise<CodegenResult>

// Granular — one layer at a time
generateDatabaseSchema(projectId, opts)   // prisma/schema.prisma
generateSharedSdk(projectId, opts)        // packages/shared/{schemas,types,errors,api-contract,sdk}
generateAuthRuntime(projectId, opts)      // apps/api/src/auth.ts
generateBackendApi(projectId, opts)       // apps/api/src/{index.ts,routes/,operations/,repositories/,middleware/}
generateFrontendNext(projectId, opts)     // apps/web/{app/,components/generated/,lib/}
generateTests(projectId, opts)            // tests/{api/,e2e/,contract/}

// Plan — dry: returns order + estimated file counts
planCodegen(projectId): Promise<{ order: CodegenLayer[], layers: Record<...> }>

// Verify
checkGeneratedProject(outDir): CheckResult         // structure check
typecheckGeneratedProject(outDir): TypecheckResult // tsc --noEmit (best-effort)
runGeneratedTests(outDir): RunTestsResult          // stub V1
diffGeneratedArtifacts(projectId, outDirA, outDirB): DiffResult

// Options
type CodegenOptions = {
  outDir?: string;         // default: /tmp/dtfs-codegen-<projectId>
  dryRun?: boolean;        // default: true
  layer?: CodegenLayer;    // "all"|"database"|"shared"|"auth"|"backend"|"frontend"|"sdk"|"tests"
};
```

Execution steps for `generateApp`:
1. Load spec from DB via Prisma (read-only).
2. Validate `outDir` with `resolveSafeOutDir`.
3. Compile contracts: `compileBackendContract` + `compileFrontendContract` + `compileSharedContract`.
4. Call emitters in order (database → shared → auth → backend → frontend → sdk → tests).
5. Compute `contentHash` (SHA-256) and `bytes` for each file.
6. If `dryRun=false`: write files + `.dtfs-manifest.json` to `outDir`.
7. Return `CodegenResult` with the manifest entries.

---

## Sandbox / Security: `resolveSafeOutDir`

```ts
resolveSafeOutDir(outDir: string, projectLocalPath?: string): string
```

**Enforced rules (throws on violation):**

| Rule | Detail |
|------|--------|
| Must be absolute | `path.isAbsolute(outDir)` |
| No path traversal | normalized path must not contain `..` segments |
| Not inside meta-platform repo | must not be under `/data/dev/design-to-fullstack/` |
| Allowed locations | `/tmp/...` OR `<projectLocalPath>/generated/...` |

If none of these conditions are met, `resolveSafeOutDir` throws with a descriptive message.
The HTTP endpoint (`POST /api/projects/:id/codegen`) catches these errors and returns HTTP 400
with `error: "sandbox_violation"`.

---

## Type Mapping — FieldType → Prisma

| FieldType   | Prisma scalar |
|-------------|---------------|
| TEXT        | String        |
| TEXTAREA    | String        |
| EMAIL       | String        |
| PASSWORD    | String        |
| NUMBER      | Float         |
| DATE        | DateTime      |
| DATETIME    | DateTime      |
| TIME        | String        |
| CHECKBOX    | Boolean       |
| RADIO       | String        |
| SELECT      | String        |
| MULTISELECT | String[]      |
| FILE        | String        |
| RICHTEXT    | String        |
| COLOR       | String        |
| RANGE       | Float         |
| HIDDEN      | String        |
| CUSTOM      | Json          |

---

## Target Arborescence (Phase 28)

```
<outDir>/
  .dtfs-manifest.json
  prisma/
    schema.prisma                     ← from emit-prisma (database layer)
  apps/
    api/
      src/
        index.ts                      ← Hono app entry (backend layer)
        auth.ts                       ← Better Auth config (auth layer)
        routes/
          <resource>.ts               ← one per Resource from BackendContract
        operations/
          index.ts                    ← operation routes
        middleware/
          guards.ts                   ← policy guards
        repositories/
          <entity>.repository.ts      ← one per entity schema
  web/
    app/
      layout.tsx                      ← root layout
      <route>/
        page.tsx                      ← one per page from FrontendContract
    components/generated/
      <ComponentType>.tsx             ← one per distinct component type
    lib/
      api/client.ts                   ← typed fetch client
      auth/client.ts                  ← Better Auth client stub
      schemas/index.ts                ← re-export from @repo/shared
  packages/
    shared/
      src/
        schemas/index.ts              ← Zod schemas (shared layer)
        types/index.ts                ← TypeScript types
        errors.ts                     ← error codes + ApiError
        api-contract.ts               ← API_OPERATIONS + API_BASE_URL
        sdk/
          client.ts                   ← typed per-operation API client (sdk layer)
          index.ts                    ← SDK barrel
        index.ts                      ← shared package barrel
  tests/
    api/
      <resource>.test.ts              ← API test stubs (tests layer)
      operations/<name>.test.ts
    contract/
      shared-types.test.ts
    e2e/
      smoke.test.ts
```

### Legacy Arborescence (Phase 17, kept for backward compat)

The legacy path (via `generateLegacyFiles()`) still emits into:
```
backend/prisma/schema.prisma
backend/src/app.ts + routes/ + operations/
frontend/src/app/
```
This is used by `dtfs__preview_generated_file`.

---

## Manifest: `.dtfs-manifest.json`

Written at `<outDir>/.dtfs-manifest.json` on every non-dry-run. Schema:

```json
{
  "projectId": "...",
  "generatedAt": "ISO-8601",
  "outDir": "/tmp/dtfs-codegen-...",
  "files": [
    {
      "path": "backend/prisma/schema.prisma",
      "kind": "CODE",
      "contentHash": "<sha256-hex>",
      "bytes": 971,
      "protected": false
    }
  ]
}
```

`protected: false` means re-runs may overwrite the file.
`contentHash` is SHA-256 of the file content (UTF-8). Same input → same hash (determinism).

Note: `GeneratedArtifact` rows are **not** persisted in this MVP. The manifest file is the
source of truth for the generated output. Persisting to DB (Phase 10 columns) is planned for V2.

---

## Dry-run

`dryRun: true` (the default everywhere) means:
- No files are written to disk.
- No directories are created.
- The `CodegenResult` is computed in memory and returned.

This is the safe default for all callers (HTTP, MCP, tests).

---

## HTTP API (Phase 28)

```
POST /api/projects/:id/codegen
Body: { dryRun?, outDir?, layer?: "all"|"database"|"shared"|"auth"|"backend"|"frontend"|"sdk"|"tests", trackArtifacts? }
→ 200 { outDir, files: [{path, kind, contentHash, bytes, protected}], counts }
→ 404 { error: "not_found" }
→ 400 { error: "sandbox_violation" }
→ 422 { error: "governance_violation" }   — non-dryRun without trackArtifacts
→ 500 { error: "codegen_failed" }

POST /api/projects/:id/codegen/plan
→ 200 { plan: { order: CodegenLayer[], layers: Record<CodegenLayer, {description, estimatedFiles}> } }

POST /api/projects/:id/codegen/check
Body: { outDir: string }
→ 200 { ok: boolean, issues: string[], checkedDirs: string[] }

POST /api/projects/:id/codegen/typecheck
Body: { outDir: string }
→ 200 { skipped: true, reason } | { skipped: false, ok, output, exitCode }
```

---

## MCP Tools (Phase 28)

### Generation
| Tool | Description |
|------|-------------|
| `dtfs__generate_app` | Full contract-driven generation (all layers). `dryRun=true` by default. |
| `dtfs__generate_database_schema` | Only `prisma/schema.prisma`. |
| `dtfs__generate_shared_sdk` | `packages/shared`: types, schemas, errors, contract, SDK. |
| `dtfs__generate_auth_runtime` | `apps/api/src/auth.ts` (Better Auth config stub). |
| `dtfs__generate_backend_api` | `apps/api/src/`: index, routes, operations, middleware, repositories. |
| `dtfs__generate_frontend_next` | `apps/web/`: pages, components/generated, lib. |
| `dtfs__generate_tests` | `tests/`: api, e2e, contract stubs. |
| `dtfs__preview_generated_file` | Re-generate a single file in memory (no disk write). |

### Planning
| Tool | Description |
|------|-------------|
| `dtfs__plan_codegen` | Return order + estimated file counts per layer, no write. |

### Verification
| Tool | Description |
|------|-------------|
| `dtfs__check_generated_project` | Verify expected dirs (apps/api, apps/web, packages/shared) + manifest. |
| `dtfs__typecheck_generated_project` | Best-effort `tsc --noEmit`. Returns `{skipped:true}` if no tsconfig. |
| `dtfs__run_generated_tests` | V1 stub: always `{skipped:true, reason:"generated tests are stubs (V1)"}`. |
| `dtfs__diff_generated_artifacts` | Compare two manifest files: `{added, removed, changed}`. |

---

## This is a traçable MVP, not a running app

The generated code is:
- **Well-formed TypeScript/Prisma syntax** (no syntax errors).
- **Not a running application**: operation handlers have `TODO` bodies; components are stubs.
- **Deterministic**: re-running codegen on the same spec produces byte-identical files.
- **Traceable**: every file has a SHA-256 hash for drift detection.

Future work (V2/V3): complete handler bodies from Step DSL, Prisma migration generation,
theme injection, i18n, auth middleware, policy middleware, test generation, deployment targets.

---

## Contract Indirection (Phase 28 — implemented)

The flow is now: **spec → contracts → emitters → files**. No emitter reads raw Control Plane
concepts directly.

```
Entity/Resource/Operation/Screen (spec)
  → compileBackendContract    → BackendContractObj  (routes, schemas, auth, middlewares, errors)
  → compileFrontendContract   → FrontendContractObj (pages, routes, forms, actions, dataBindings)
  → compileSharedContract     → SharedContractObj   (types, schemas, errors, apiClient, events)
     → emitPrismaSchema           (database layer — still reads spec.entities directly)
     → emitSharedPackage          (shared layer   — reads SharedContract)
     → emitAuthRuntime            (auth layer     — reads BackendContract.auth)
     → emitHonoBackendApi         (backend layer  — reads BackendContract.routes)
     → emitNextFrontend           (frontend layer — reads FrontendContract.pages)
     → emitSdk                    (sdk layer      — reads SharedContract.apiClient)
     → emitTests                  (tests layer    — reads BackendContract + SharedContract)
```

### Emitter mapping

| Emitter | Input | Output path |
|---------|-------|-------------|
| `emitPrismaSchema` | `CodegenSpec.entities` | `prisma/schema.prisma` |
| `emitSharedPackage` | `SharedContractObj` | `packages/shared/src/` |
| `emitAuthRuntime` | `BackendContractObj.auth` | `apps/api/src/auth.ts` |
| `emitHonoBackendApi` | `BackendContractObj` | `apps/api/src/` |
| `emitNextFrontend` | `FrontendContractObj` | `apps/web/` |
| `emitSdk` | `SharedContractObj` | `packages/shared/src/sdk/` |
| `emitTests` | `BackendContractObj` + `SharedContractObj` | `tests/` |
| `emitHonoRoutes` (legacy) | `CodegenSpec` | `backend/src/routes/` |
| `emitNextPages` (legacy) | `CodegenSpec` | `frontend/src/app/` |

### Reference Docs

- `RUNTIME_TARGET.md` — which tech stack to target
- `BACKEND_CONTRACT.md` — compiled backend surface (routes, schemas, auth, errors)
- `FRONTEND_CONTRACT.md` — compiled frontend surface (pages, components, forms, bindings)
- `SHARED_CONTRACT.md` — shared types, SDK, error catalog
- `HONO_GENERATION.md` — Hono ~4.12 emitter details
- `BETTER_AUTH_GENERATION.md` — Better Auth emitter details
- `NEXT16_GENERATION.md` — Next 16 App Router emitter details
- `SDK_GENERATION.md` — `packages/shared/` emitter details
- `GENERATED_ARTIFACTS.md` — artifact tracking + drift detection
