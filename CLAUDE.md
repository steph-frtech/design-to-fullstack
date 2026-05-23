# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

## Project Context

A "design-to-fullstack" monorepo: turn designs into full-stack apps. See `README.md` for the user-facing overview.

### Stack

- **Package manager**: pnpm 10 (workspaces declared in `pnpm-workspace.yaml` — NOT `package.json#workspaces`). Workspace deps use the `workspace:*` protocol.
- **Backend** (`backend/`): Hono 4 + `@modelcontextprotocol/sdk` + Prisma 7 + better-auth + Zod, run via `tsx` (Node). Exports `AppType` for end-to-end typesafe RPC.
- **Frontend** (`frontend/web/`): Next.js 16 (App Router) + React 19 + Tailwind v4 + TanStack Query. Consumes `backend`'s `AppType` via `hono/client`.
- **Database**: PostgreSQL via Prisma 7. Schema lives at `backend/prisma/schema.prisma`; client output is `backend/generated/prisma/` (gitignored). Connection is provided at **runtime** via `@prisma/adapter-pg` — there is no `url` in the schema's `datasource` block (Prisma 7 dropped it).
- **Formatter/Linter**: Biome 2.4 — tab indentation, double quotes, organize-imports on save.
- **Env**: single `.env` at the repo root, loaded by `backend/prisma.config.ts` via `dotenv.config({ path: "../.env" })` and by `tsx --env-file=../.env` at runtime.
- **Skills** (`skills/`): plain markdown directory for Claude Code skills (one folder per skill with `SKILL.md`). Not auto-discovered — symlink into `.claude/skills/` to load.

### Commands

```bash
pnpm install                              # install all workspaces
pnpm rebuild -r                           # if postinstall scripts didn't run (esbuild, sharp, prisma)
pnpm dev:backend                          # tsx watch on :4000
pnpm dev:web                              # next dev on :3000
pnpm typecheck                            # tsc across all workspaces (-r)
pnpm lint / pnpm format                   # Biome
pnpm --filter backend db:generate         # prisma generate
pnpm --filter backend db:migrate          # prisma migrate dev
pnpm --filter backend mcp                 # MCP server over stdio
```

Workspace-scoped scripts use `pnpm --filter <name>`. Do not invent npm scripts that don't exist in `package.json`.

### Claude tooling layer (important)

This repo is heavily configured via `claude-code-up` (see `STACK.md` and `.claude/stack.json` for the full inventory). Two things to know:

- **Stop hook runs a security audit**: `.claude/settings.json` registers `.claude/scripts/audit.sh` on `Stop`, which runs `npx ecc-agentshield scan` against `.claude/`. Expect a network/npx call at the end of every turn.
- **MCP servers in `.mcp.json`**: github, context7, playwright, postgres, stripe, revenuecat, better-auth, dockerhub, trivy, supabase. They pull credentials from env vars (`GITHUB_PERSONAL_ACCESS_TOKEN`, `POSTGRES_CONNECTION_STRING`, `STRIPE_SECRET_KEY`, `SUPABASE_*`, etc.) — missing vars cause silent connection failures, not crashes.
- **Experimental flag**: `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` is set in project settings.
- **Many skills/agents are pre-installed** under `.claude/skills/` and `.claude/agents/` (superpowers, pocock, scenario-tester, wshobson). Prefer invoking an installed skill over reimplementing its workflow.

Do not modify `.claude/` files casually — they're generated by `claude-code-up` and may be regenerated.
