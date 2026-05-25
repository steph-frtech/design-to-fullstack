# RuntimeTarget

> Status: **design doc** — model does not exist in schema.prisma yet. Added in Phase 25.
> References: `RUNTIME_CONTRACTS_OVERVIEW.md`, `plan.md` L879-900, `BACKEND_CONTRACT.md`, `FRONTEND_CONTRACT.md`.

---

## What Is a RuntimeTarget

A `RuntimeTarget` declares the concrete technology stack a project will generate code for.
It is the single source of truth for "which framework, which version, which runtime."

Every contract compiler (`compileBackendContract`, `compileFrontendContract`, `compileSharedContract`) reads the `RuntimeTarget` first and uses it to decide how to emit code (e.g., Hono ~4.12 vs another framework, App Router vs Pages Router).

One project can have multiple named `RuntimeTarget` rows (e.g., `"default"`, `"edge"`, `"ssr-only"`) but in practice most projects have exactly one: the default `hono-next` target.

---

## Model Shape (doc form — not yet in schema.prisma)

```
RuntimeTarget {
  id             String   — cuid
  projectId      String   — FK Project (cascade delete)
  name           String   — "default" | "hono-next" | …
  backend        Json     — BackendTargetConfig
  frontend       Json     — FrontendTargetConfig
  auth           Json     — AuthTargetConfig
  database       Json     — DatabaseTargetConfig
  packageManager String?  — "pnpm" | "bun" | "npm"
  runtime        String?  — "node" | "bun" | "edge"
  config         Json?    — extra key-value overrides
  createdAt      DateTime
  updatedAt      DateTime
  UNIQUE(projectId, name)
}
```

---

## Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Primary key |
| `projectId` | String | FK to `Project` — cascade on delete |
| `name` | String | Human-readable target name; `"default"` for the primary target |
| `backend` | Json | Which backend framework + version + API style |
| `frontend` | Json | Which frontend framework + version + router + rendering strategy |
| `auth` | Json | Which auth provider + where it mounts |
| `database` | Json | Which database + ORM |
| `packageManager` | String? | `"pnpm"` (default), `"bun"`, `"npm"` |
| `runtime` | String? | `"node"` (default), `"bun"`, `"edge"` |
| `config` | Json? | Arbitrary overrides for emitter-specific knobs |
| `createdAt` / `updatedAt` | DateTime | Standard timestamps |

---

## Default Target — hono-next

The default `RuntimeTarget` for a new project:

```json
{
  "name": "default",
  "backend": {
    "framework": "hono",
    "versionPolicy": "~4.12",
    "runtime": "node",
    "apiStyle": "rest"
  },
  "frontend": {
    "framework": "next",
    "version": "16.x",
    "router": "app",
    "rendering": "server-components-first"
  },
  "auth": {
    "provider": "better-auth",
    "basePath": "/api/auth"
  },
  "database": {
    "provider": "postgresql",
    "orm": "prisma"
  },
  "packageManager": "pnpm",
  "runtime": "node"
}
```

---

## How It Drives Generation

The `RuntimeTarget` is consumed at the start of each contract compilation step:

```
compileBackendContract(projectId)
  1. Load RuntimeTarget for project (name = "default" unless specified)
  2. Read backend.framework → choose Hono emitter
  3. Read backend.versionPolicy → pin import versions
  4. Read auth.provider → choose Better Auth config emitter
  5. Read database.orm → choose Prisma schema emitter
  → Produces BackendContract row

compileFrontendContract(projectId)
  1. Load same RuntimeTarget
  2. Read frontend.framework + version → choose Next 16 emitter
  3. Read frontend.router → "app" → use App Router conventions
  4. Read frontend.rendering → "server-components-first" → prefer RSC
  → Produces FrontendContract row

compileSharedContract(projectId)
  1. Load same RuntimeTarget
  2. Read database.orm → Prisma types as base for DTOs
  → Produces SharedContract row
```

If the `RuntimeTarget` is changed (e.g., switching `frontend.framework` from `"next"` to `"remix"`), all three contracts are invalidated and must be recompiled before the next codegen run.

---

## Version Reference (Default Target)

| Technology | Target version | Source |
|------------|---------------|--------|
| Hono | `~4.12.x` | `backend.versionPolicy` |
| `@hono/node-server` | matching Hono | implicit |
| Next.js | `16.x` | `frontend.version` |
| React | `19.x` | implied by Next 16 |
| Better Auth | latest stable | `auth.provider` |
| PostgreSQL | 14+ | `database.provider` |
| Prisma | `7.x` | `database.orm` |
| Zod | `^3.x` | shared across backend + frontend |
| pnpm | `10.x` | `packageManager` |

---

## Constraints

- `UNIQUE(projectId, name)` — at most one target with a given name per project.
- `name = "default"` is always present for a project that has been initialized for codegen.
- The `config` field is a catch-all escape hatch; emitters must ignore unknown keys gracefully.
- Changing `backend.framework` or `frontend.framework` requires invalidating ALL downstream contracts and generated artifacts.

---

## Related Docs

- `RUNTIME_CONTRACTS_OVERVIEW.md` — why this layer exists
- `BACKEND_CONTRACT.md` — what the RuntimeTarget's backend config produces
- `FRONTEND_CONTRACT.md` — what the RuntimeTarget's frontend config produces
- `SHARED_CONTRACT.md` — the bridge between backend and frontend
- `HONO_GENERATION.md` — Hono-specific generation details
- `NEXT16_GENERATION.md` — Next 16-specific generation details
- `BETTER_AUTH_GENERATION.md` — Better Auth-specific generation details
