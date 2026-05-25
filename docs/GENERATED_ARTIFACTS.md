# Generated Artifacts

> Status: **design doc** — `GeneratedArtifact` model exists (Phase 0 skeleton). Enrichment with contract linkage begins in Phase 25.
> References: `CODEGEN.md`, `RUNTIME_CONTRACTS_OVERVIEW.md`, `BACKEND_CONTRACT.md`, `FRONTEND_CONTRACT.md`, `SHARED_CONTRACT.md`.

---

## What This Doc Covers

How generated files are tracked, versioned, and protected from accidental overwrite.

The `GeneratedArtifact` model is the traceability layer between:
- The Control Plane (what was specified)
- The Contracts (what was compiled)
- The generated code on disk (what was emitted)

---

## Current Model (Phase 0 skeleton — in schema.prisma)

```prisma
model GeneratedArtifact {
  id         String   @id @default(cuid())
  projectId  String
  path       String
  kind       String?
  content    String?
  hash       String?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  project    Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
}
```

This is the Phase 0 skeleton. The Phase 25 enrichment adds contract linkage fields.

---

## Enriched Model (Phase 25 — doc form)

```
GeneratedArtifact {
  id               String    — cuid
  projectId        String    — FK Project (cascade delete)
  runtimeTargetId  String?   — FK RuntimeTarget (which target generated this)
  backendContractId  String? — FK BackendContract (if source is backend)
  frontendContractId String? — FK FrontendContract (if source is frontend)
  sharedContractId   String? — FK SharedContract (if source is shared)
  changeSetId      String?   — FK ChangeSet that triggered this generation
  path             String    — relative path within the generated output
  kind             GeneratedArtifactKind — enum
  contentHash      String    — SHA-256 of file content (UTF-8)
  bytes            Int       — file size in bytes
  protected        Boolean   — if true, codegen will not overwrite on re-run
  ownership        String    — "generated" | "custom" | "mixed"
  generatedAt      DateTime  — when this artifact was last generated
  createdAt        DateTime
  updatedAt        DateTime
  UNIQUE(projectId, path)
}
```

---

## Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Primary key |
| `projectId` | String | FK to `Project` — cascade on delete |
| `runtimeTargetId` | String? | Which `RuntimeTarget` was active when this was generated |
| `backendContractId` | String? | If generated from backend layer: FK to `BackendContract` |
| `frontendContractId` | String? | If generated from frontend layer: FK to `FrontendContract` |
| `sharedContractId` | String? | If generated from shared layer: FK to `SharedContract` |
| `changeSetId` | String? | The `ChangeSet` that triggered the codegen run |
| `path` | String | Relative path within output directory (e.g., `apps/api/src/routes/customers.ts`) |
| `kind` | GeneratedArtifactKind | See enum below |
| `contentHash` | String | SHA-256 hex of the file content — used for drift detection |
| `bytes` | Int | File size in bytes |
| `protected` | Boolean | If `true`, the file has been marked as hand-edited; codegen skips overwrite |
| `ownership` | String | `"generated"` (fully managed), `"custom"` (user-owned), `"mixed"` (partial) |
| `generatedAt` | DateTime | Timestamp of last codegen that wrote this artifact |
| `createdAt` / `updatedAt` | DateTime | Row-level timestamps |

---

## GeneratedArtifactKind Enum

| Value | Description |
|-------|-------------|
| `PRISMA_SCHEMA` | `prisma/schema.prisma` |
| `HONO_ROUTE` | `apps/api/src/routes/<resource>.ts` |
| `HONO_OPERATION` | `apps/api/src/operations/<op>.ts` |
| `HONO_POLICY` | `apps/api/src/policies/<policy>.ts` |
| `HONO_REPOSITORY` | `apps/api/src/repositories/<entity>.ts` |
| `HONO_MIDDLEWARE` | `apps/api/src/middleware/*.ts` |
| `BETTER_AUTH` | `apps/api/src/auth.ts` |
| `NEXT_PAGE` | `apps/web/app/**/*page.tsx` |
| `NEXT_COMPONENT` | `apps/web/components/generated/*.tsx` |
| `NEXT_LAYOUT` | `apps/web/app/**/layout.tsx` |
| `SHARED_TYPE` | `packages/shared/src/types/*.ts` |
| `SHARED_SCHEMA` | `packages/shared/src/schemas/*.ts` |
| `SHARED_ERRORS` | `packages/shared/src/errors.ts` |
| `SHARED_API_CONTRACT` | `packages/shared/src/api-contract.ts` |
| `SDK_CLIENT` | `apps/web/lib/api/*.ts` |
| `TEST_UNIT` | `tests/unit/*.test.ts` |
| `TEST_INTEGRATION` | `tests/integration/*.test.ts` |
| `TEST_E2E` | `tests/e2e/*.spec.ts` |
| `MANIFEST` | `.dtfs-manifest.json` |
| `CONFIG` | `package.json`, `tsconfig.json`, `next.config.ts` |

The `GeneratedArtifactKind` enum is added to the Prisma schema in the `phase_10_enriched_models` migration.

---

## The Manifest File

On each non-dry-run codegen pass, a `.dtfs-manifest.json` is written to the output root:

```json
{
  "projectId": "prj_xxx",
  "generatedAt": "2026-05-24T10:00:00.000Z",
  "runtimeTargetId": "rt_xxx",
  "backendContractId": "bc_xxx",
  "frontendContractId": "fc_xxx",
  "sharedContractId": "sc_xxx",
  "changeSetId": "cs_xxx",
  "outDir": "/tmp/dtfs-codegen-prj_xxx",
  "files": [
    {
      "path": "apps/api/src/routes/customers.ts",
      "kind": "HONO_ROUTE",
      "contentHash": "sha256:abc123...",
      "bytes": 1042,
      "protected": false,
      "ownership": "generated"
    },
    {
      "path": "apps/web/app/customers/page.tsx",
      "kind": "NEXT_PAGE",
      "contentHash": "sha256:def456...",
      "bytes": 834,
      "protected": true,
      "ownership": "mixed"
    }
  ]
}
```

The manifest is the on-disk record. The `GeneratedArtifact` rows in the DB are the persistent record.
Both are kept in sync by the codegen orchestrator.

---

## Drift Detection

On re-codegen, the orchestrator:

1. Recompiles contracts (if any Control Plane change since last run).
2. Re-runs all emitters to get new content.
3. Computes `contentHash` for each file.
4. Loads existing `GeneratedArtifact` rows from DB.
5. For each file:
   - If no row exists → new file (write + create row).
   - If row exists and `contentHash` matches → no change (skip).
   - If row exists and `contentHash` differs AND `protected = false` → overwrite + update row.
   - If row exists and `contentHash` differs AND `protected = true` → skip (report as drift).

Drift is reported to the caller; the codegen does not fail on drift unless `driftPolicy = "strict"`.

---

## The `protected` Flag

A file becomes `protected` when:
1. A human edits it (detected by `contentHash` mismatch on next codegen run and drift-policy = `interactive` prompts the user).
2. The MCP tool `dtfs__protect_artifact` is called explicitly (Phase 26 tool — not yet registered).
3. The file path matches a configured `protectedPaths` pattern in `RuntimeTarget.config`.

A `protected` file is never automatically overwritten. The user must:
- Un-protect it explicitly, OR
- Accept that the generated version will be written to `<path>.gen.ts` alongside the protected file.

---

## Ownership Values

| Ownership | Meaning |
|-----------|---------|
| `"generated"` | Entirely managed by codegen. Safe to overwrite. |
| `"custom"` | Entirely hand-written. Never touched by codegen. |
| `"mixed"` | Started as generated, then partially edited. Requires drift review. |

---

## Contract Linkage

Each `GeneratedArtifact` row links back to the contract it was generated from:

| Artifact kind | Links to |
|--------------|----------|
| `HONO_ROUTE`, `HONO_OPERATION`, `HONO_POLICY`, `BETTER_AUTH`, `PRISMA_SCHEMA` | `backendContractId` |
| `NEXT_PAGE`, `NEXT_COMPONENT`, `NEXT_LAYOUT` | `frontendContractId` |
| `SHARED_TYPE`, `SHARED_SCHEMA`, `SHARED_ERRORS`, `SHARED_API_CONTRACT`, `SDK_CLIENT` | `sharedContractId` |
| `TEST_*` | both `backendContractId` and `frontendContractId` |
| `MANIFEST`, `CONFIG` | no contract link — project-level artifacts |

This linkage allows the codegen orchestrator to selectively regenerate only the files
whose source contract changed.

---

## MCP Tools (Phase 26 — not yet registered)

| Tool | Description |
|------|-------------|
| `dtfs__list_generated_artifacts` | List all artifacts for a project, filterable by kind |
| `dtfs__get_generated_artifact` | Get a single artifact row |
| `dtfs__protect_artifact` | Mark an artifact as protected |
| `dtfs__unprotect_artifact` | Remove the protected flag |
| `dtfs__diff_generated_artifacts` | Compare artifact hashes across two codegen runs |
| `dtfs__preview_generated_file` | Already registered — see `CODEGEN.md` |

---

## Related Docs

- `CODEGEN.md` — Phase 17 MVP (manifest without DB persistence)
- `RUNTIME_CONTRACTS_OVERVIEW.md` — the overall architecture
- `BACKEND_CONTRACT.md` — source of backend artifacts
- `FRONTEND_CONTRACT.md` — source of frontend artifacts
- `SHARED_CONTRACT.md` — source of shared artifacts
- `HONO_GENERATION.md` — what backend artifacts look like
- `NEXT16_GENERATION.md` — what frontend artifacts look like
- `SDK_GENERATION.md` — what shared artifacts look like
