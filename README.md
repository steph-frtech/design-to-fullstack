# design-to-fullstack

Turn designs into full-stack apps. Pnpm monorepo with a Hono + MCP backend, a Next.js web frontend, and Claude Code skills.

## Stack

| Layer | Tech |
|---|---|
| Package manager | pnpm 10 (workspaces) |
| Backend | Node + tsx, Hono 4, `@modelcontextprotocol/sdk`, Prisma 7 (driver adapter `@prisma/adapter-pg`), better-auth, Zod |
| Frontend | Next.js 16, React 19, Tailwind v4, TanStack Query, Hono RPC client (typesafe end-to-end) |
| Database | PostgreSQL |
| Tooling | Biome 2.4 (lint + format), TypeScript 5 |

## Layout

```
backend/                 # Hono REST + MCP server
  prisma/schema.prisma   # User/Session/Account/Verification (better-auth) + Project
  src/
    app.ts               # Hono routes — exports AppType for the frontend
    server.ts            # HTTP entry (port 4000)
    mcp.ts               # MCP server definition
    mcp-server.ts        # MCP stdio entry
    auth.ts              # better-auth
    db.ts                # Prisma client + pg adapter

frontend/web/            # Next.js App Router
  src/
    app/                 # layout, page, Providers (React Query)
    lib/api.ts           # Hono RPC client (import type { AppType } from "backend")
    lib/auth-client.ts   # better-auth React client

skills/                  # Claude Code skills (markdown)
```

## Setup

```bash
# 1. Install
pnpm install
pnpm rebuild -r          # if postinstall scripts (esbuild, sharp, @prisma/engines) didn't run

# 2. Set env
# Edit .env at the repo root — DATABASE_URL, GITHUB_PERSONAL_ACCESS_TOKEN, etc.

# 3. DB
pnpm --filter backend db:generate    # generate Prisma client → backend/generated/prisma/
pnpm --filter backend db:migrate     # apply migrations

# 4. Run
pnpm dev:backend         # → http://localhost:4000
pnpm dev:web             # → http://localhost:3000
```

## Commands

```bash
pnpm dev:backend                          # tsx watch
pnpm dev:web                              # next dev
pnpm typecheck                            # tsc across workspaces
pnpm lint / format                        # Biome
pnpm --filter backend db:migrate          # prisma migrate dev
pnpm --filter backend db:studio           # prisma studio
pnpm --filter backend mcp                 # MCP server over stdio
```

## How it fits together

- **Typesafe frontend ↔ backend** : `backend/src/index.ts` exports `AppType` (the Hono app type). `frontend/web/src/lib/api.ts` consumes it via `hc<AppType>(BACKEND_URL)` — endpoints, params, and responses are typechecked end-to-end. No code generation step.
- **MCP** : the same Hono server exposes `/mcp` (HTTP transport via Node `IncomingMessage`/`ServerResponse` bridging through `@hono/node-server`'s `HttpBindings`). A separate stdio entry (`pnpm --filter backend mcp`) is available for CLI-style MCP clients.
- **Auth** : better-auth runs as Hono routes under `/api/auth/*`, backed by Prisma. The frontend uses `better-auth/react` against `${BACKEND_URL}/api/auth`.

## Notes

- `.env` is at the repo root and loaded by `backend/prisma.config.ts` via dotenv (`path: "../.env"`), and by `tsx --env-file=../.env` at runtime.
- Prisma 7 dropped `url` from the schema's `datasource` block — connection is provided at runtime via `@prisma/adapter-pg`.
- The `@claude` tooling layer (`.claude/`, `.mcp.json`, `STACK.md`) is managed by `claude-code-up`; see `STACK.md` for the inventory.
