# design-to-fullstack

A meta-application that turns **designs into running full-stack apps**. The platform lets a designer/no-coder describe their app's screens, forms, data and translations in a structured way (importable from a design tool), and renders that definition as a real working app — multilingual, with versioned definitions, and content management for the data the end-users produce.

Concretely:

- **You (the designer)** open the app, create a Project, define its Screens, drop Components, configure Forms with Fields, declare Entities, and add Translations — all stored in the database.
- **Your end-users** access the rendered Project, see your screens in their language, fill the Forms — each submission is stored as an `EntityRecord`.
- **Every change** to definitions is automatically captured into a `Revision` table with a JSON snapshot + diff and version number. You can browse the history of any Screen/Component/Field.

> **Scope of this repo**: the platform itself — the builder UI, the runtime renderer, the DB schema, and the API. Designs and rendered apps live as rows in Postgres, not as separate codebases. (A future "publish" feature could emit a standalone codebase per Project; not implemented yet.)

## Conceptual model

```
Project ── locales: ProjectLocale → Locale ─┐
   │                                         ├── TextKey ── Translation (key, locale → value)
   ├── Theme                                 │
   ├── Entity ──── Attribute (typed)         │
   │     └─── EntityRecord (data JSON)       │
   └── Screen ─── Component (tree, type+config JSON)
                       └─── Form ─── Field ─── FieldOption
                                              (all i18n via labelKey/placeholderKey/helpKey)
```

Every model except `Locale`, `TextKey` and the auth tables has `currentVersion` and is auto-snapshotted into `Revision` on create/update/delete via a Prisma extension (`backend/src/versioning.ts`).

## Stack

| Layer | Tech |
|---|---|
| Package manager | pnpm 10 (workspaces) |
| Backend | Node + tsx, Hono 4, `@modelcontextprotocol/sdk`, Prisma 7 (`@prisma/adapter-pg`), better-auth, Zod |
| Frontend | Next.js 16, React 19, Tailwind v4, TanStack Query, Hono RPC client (typesafe end-to-end) |
| Database | PostgreSQL — everything isolated in the `dtfs` schema (so the DB can be shared with other apps) |
| Tooling | Biome 2.4 (lint + format), TypeScript 5 |

## Layout

```
backend/
  prisma/schema.prisma           # all tables in schema "dtfs"
  src/
    server.ts                    # Hono HTTP entry (port 4000)
    app.ts                       # routes — exports AppType for the frontend
    projects.ts                  # /api/projects, /api/revisions, /api/translations
    db.ts                        # PrismaClient + adapter-pg + versioning extension
    versioning.ts                # Prisma $extends that writes Revision rows on every mutation
    auth.ts                      # better-auth (prismaAdapter)
    mcp.ts, mcp-server.ts        # MCP server (stdio + future HTTP transport)
    seed.ts                      # idempotent demo seed

frontend/web/
  src/
    app/
      page.tsx                          # Projects list (home)
      projects/[id]/page.tsx            # Project detail
      projects/[id]/screens/[screenId]/page.tsx  # Component tree + revision history
      routes/page.tsx                   # next-route-visualizer dev tool
      layout.tsx, providers.tsx, globals.css
    lib/api.ts                          # Hono RPC client (typed via `import type { AppType } from "backend"`)
    lib/auth-client.ts                  # better-auth React client

skills/                                  # Claude Code skills (markdown)
```

## Routes

### Frontend pages

| Path | Purpose |
|---|---|
| `/` | Projects list (the "builder home") |
| `/projects/[id]` | Project detail — locales, entities, screens |
| `/projects/[id]/screens/[screenId]` | Screen builder view: component tree + per-node revision history side-panel |
| `/routes` | Visual map of the app's routes (via `next-route-visualizer`) |

### Backend API

| Endpoint | Description |
|---|---|
| `GET /health` | Liveness |
| `GET /api/hello?name=` | Demo endpoint (kept for now) |
| `GET /api/projects` | Project list with counts |
| `GET /api/projects/:id` | Project + locales + theme + entities + screens |
| `GET /api/projects/:id/screens/:screenId` | Screen with full component tree + form fields/options |
| `GET /api/revisions?entityType=&entityId=` | History for any entity |
| `GET /api/translations?locale=` | Translations (optionally filtered) |
| `GET\|POST /api/auth/*` | better-auth (sign-up/in, sessions) |
| `ALL /mcp` | MCP server over HTTP (Streamable transport) |

## Setup

```bash
# 1. Install
pnpm install
pnpm rebuild -r          # if postinstall scripts (esbuild, sharp, @prisma/engines) didn't run

# 2. Env (root .env)
DATABASE_URL="postgresql://…"
BETTER_AUTH_URL="http://localhost:4001"
BETTER_AUTH_SECRET="…32-bytes-hex…"
FRONTEND_URL="http://localhost:3001"
PORT=4001

# 3. DB
pnpm --filter backend exec prisma generate
# WARNING: read the section "DB isolation" below before running migrations
pnpm --filter backend db:migrate
pnpm --filter backend seed

# 4. Run
pnpm dev:backend         # → http://localhost:4001
pnpm dev:web             # → http://localhost:3001
```

## Commands

```bash
pnpm dev:backend                          # tsx watch
pnpm dev:web                              # next dev
pnpm typecheck                            # tsc across workspaces
pnpm lint / format                        # Biome
pnpm --filter backend db:generate         # prisma generate
pnpm --filter backend db:migrate          # prisma migrate dev
pnpm --filter backend db:studio           # prisma studio
pnpm --filter backend seed                # idempotent demo data
pnpm --filter backend mcp                 # MCP server over stdio
```

## How the pieces fit

- **Typesafe RPC** — `backend/src/index.ts` exports `AppType` (the chained Hono app type). `frontend/web/src/lib/api.ts` consumes it via `hc<AppType>(BACKEND_URL)`. Endpoints, params, and responses are typechecked end-to-end — no codegen step.
- **Versioning** — every mutation on a versioned model goes through a Prisma `$extends` query interceptor (`versioning.ts`) that bumps `currentVersion` and writes a `Revision` row with a full snapshot + diff. The CMS UI queries `/api/revisions` to render the timeline.
- **i18n** — all translatable strings are referenced by `TextKey.namespace` (e.g. `field.email.label`). Values per locale live in `Translation`. Adding a language is a row in `Locale` + N rows in `Translation` — no schema migration.
- **MCP** — same Hono server exposes `/mcp` (Streamable HTTP transport via `@hono/node-server`'s `HttpBindings`). A separate stdio entry (`pnpm --filter backend mcp`) is available for CLI-style MCP clients.

## DB isolation (important)

The Postgres connection can be shared with other apps without conflict: **all `design-to-fullstack` tables live in the `dtfs` schema**, including the better-auth ones (`User`/`Session`/`Account`/`Verification`). The `public` schema is never touched by this project's migrations. The Prisma datasource declares `schemas = ["dtfs"]`, so introspection and migrate are scoped accordingly.

## Notes

- `.env` is at the repo root, loaded by `backend/prisma.config.ts` via dotenv (`path: "../.env"`), and by `tsx --env-file=../.env` at runtime.
- Prisma 7 dropped `url` from the schema's `datasource` block — connection is provided at runtime via `@prisma/adapter-pg`.
- The `.claude/` / `.mcp.json` / `STACK.md` tooling layer is managed by [`claude-code-up`](https://github.com/) (see `STACK.md` for the inventory).

## Roadmap (not implemented)

- **Builder mutations** — currently the project/screen/component definitions are read-only in the UI; the CMS-style edit forms still need to be built. Mutations through the API will benefit from the existing versioning extension automatically.
- **Runtime renderer** — a `/p/[slug]/[…path]` route that *renders* a Project's screens as a real app for end-users (forms → records, in the user's locale).
- **CCup-style "New project" wizard** — a multi-step UI (replicating `claude-code-up`'s flow) to scaffold a brand-new fullstack project on disk + GitHub from inside the platform. See `/data/dev/ccup` for the reference CLI behavior.
- **Authentication UI** — `better-auth` is wired but there's no sign-in screen yet; everything is currently unauthenticated.
