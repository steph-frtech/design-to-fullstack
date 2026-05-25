# 00 — Global Architecture

> Status: stable

## What this diagram shows

The complete DTFS pipeline from user input to a running Docker app.

**Left to right / top to bottom reading:**

1. **User** — provides natural language, HTML mockups, Figma exports via Obsidian, Claude Code, or the DTFS UI.
2. **Obsidian / Claude Code / UI DTFS** — the three entry points used to interact with the system.
3. **Natural Spec** — ProductSpec + ScreenSpec extracted by LLM agents from the user's description.
4. **Spec Kit** — four SpecArtifact documents (CONSTITUTION, SPEC, PLAN, TASKS) that the platform commits to.
5. **Control Plane** — DeltaSpec validated and applied via a ChangeSet, resulting in a stable ProjectSpec.
6. **Runtime Contracts** — BackendContract + FrontendContract + SharedContract compiled from the ProjectSpec.
7. **Codegen** — emitters read contracts and write GeneratedArtifact files.
8. **Generated Client App** — Hono API + Next 16 web + Prisma schema in `generated-app/`.
9. **Docker Runtime** — `docker compose up` brings up api + web + postgres + migrations + healthchecks.

## Key principle

The Control Plane never generates code directly. It always passes through the contracts layer first.

## Related notes

- [[EXECUTION_FLOW]] — layer-by-layer walk-through
- [[RUNTIME_CONTRACTS_OVERVIEW]] — contracts design doc
- [[02-natural-language-to-codegen]] — detailed spec pipeline diagram
