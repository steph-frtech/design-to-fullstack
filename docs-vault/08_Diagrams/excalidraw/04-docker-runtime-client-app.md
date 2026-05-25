# 04 — Docker Runtime Client App

> Status: cible (design target — codegen not yet implemented)

## What this diagram shows

The `docker-compose` topology of a generated client app at runtime.

**Services inside the compose:**

| Service | Image | Port | Notes |
|---------|-------|------|-------|
| `api` | custom Node image | :3001 | Hono 4, Better Auth `/api/auth/*`, Prisma 7 with `@prisma/adapter-pg`, healthcheck `GET /health` |
| `web` | custom Node image | :3000 | Next 16 App Router, React Compiler, Turbopack in dev; healthcheck `GET /` |
| `db` | `postgres:16-alpine` | 5432 (internal) | Volume `client-db`, runs `prisma migrate deploy` on first boot, then `prisma db seed` |
| `migrate` | same as api | — | Init container pattern: runs migrations, exits 0 |
| `seed` | same as api | — | Init container: runs seed script, exits 0 |

**Data flow:**
- `web` calls `api` via the typed SDK client (from SharedContract.apiClient)
- `api` talks to `db` via `@prisma/adapter-pg` (no DATABASE_URL in prisma schema — passed at runtime)
- `migrate` and `seed` depend on `db` being healthy before running

**Not in scope for the control plane:**
- The control plane never connects to this `db`
- Auth sessions are stored in the client `db`, not in the control plane DB

## Related notes

- [[CLIENT_APP_RUNTIME]] — architecture of the runtime
- [[GENERATED_ARTIFACTS]] — what gets written to disk
- [[SEPARATION_OF_CONCERNS]] — why data never mixes
