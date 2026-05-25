# DTFS Vault

Documentation vault for the Design-to-Fullstack platform. Single source of truth for architecture, decisions, AI agent context, and the gap between current state and target state.

---

## Purpose

This vault documents the DTFS platform itself (Control Plane, DSLs, codegen pipeline, runtime contracts), not the apps it generates. It is the shared mental model for human developers and AI agents working on the platform.

Key boundary: **Control Plane database ≠ Client App database**. The Control Plane stores definitions (specs, entities, policies, operations). Generated apps get their own schema (`gen_<slug>`). Never confuse the two.

---

## Structure

```
docs-vault/
  00_Home/         Entry points: home page, map of content, AI index, glossary
  01_Product/      Product vision, roadmap, personas
  02_Architecture/ Architecture overview, two-plane model, pipeline layers
  03_Control_Plane/ Control Plane models, DeltaSpec, ChangeSet, Revision
  04_DSL/          Expr DSL, Operation DSL, Policy DSL, validation rules
  05_Contracts/    RuntimeTarget, BackendContract, FrontendContract, SharedContract
  06_Codegen/      Codegen pipeline, emitters (Hono, Next.js, Prisma, Auth, SDK)
  07_Generated_App/ Client app runtime, Docker, Client App DB
  08_Spec_Kit/     ProductSpec, ScreenSpec, Requirements, PlatformSpecProposal
  09_Diagrams/     Excalidraw diagrams (.excalidraw files versioned here)
  10_ADR/          Architecture Decision Records
  11_AI_Rules/     Rules for AI agents: what never to break, order of operations
  12_Audit/        Audit reports, gap analysis, conformity tables
  13_AI_Context/   Synthetic context files for LLM onboarding
  assets/
    images/        Static images embedded in notes
    exports/       Exported PNGs/SVGs from diagrams (gitignored)
```

---

## How to use with Obsidian

1. Open this `docs-vault/` folder as an Obsidian vault (File > Open vault > select folder).
2. Enable the **Graph view** to navigate `[[wikilinks]]` visually.
3. Install the **Excalidraw** community plugin to edit diagrams in `09_Diagrams/`.
4. Use **Dataview** (optional) to query status fields across notes.
5. The `.obsidian/` folder is gitignored — each developer keeps their own workspace settings.

---

## How to use with AI agents

- Start at `[[AI_INDEX]]` — it lists what to read before making changes.
- Consult `[[AI_RULES]]` and `[[AI_DO_NOT_BREAK]]` before any structural change.
- Each note has a `## Source of truth` section pointing to the actual code or doc file.
- Use the `## Status` field to understand what is implemented vs. still a target.

---

## How to update diagrams

- Source files are `.excalidraw` JSON in `09_Diagrams/` — commit these.
- Exported `.png`/`.svg` go in `assets/exports/` which is gitignored.
- When you update a diagram, update the corresponding `## Status` in the linked note.

---

## How to update ADRs

- New decision: create `10_ADR/ADR-NNN-short-title.md` using the template in `10_ADR/`.
- Status values: `proposed` / `accepted` / `superseded` / `deprecated`.
- Never delete an ADR — mark it superseded and link to the replacement.

---

## How to validate docs

- `## Source of truth` must point to a real file/line that exists in the repo.
- `## Status` must be one of: `documented` / `partially implemented` / `implemented` / `tested`.
- Run `pnpm typecheck` and `pnpm lint` to confirm code-side claims are still valid.

---

## Git workflow

Branch naming: `docs/<topic>` for documentation PRs.

Commit prefix conventions:

| Prefix     | When to use                                      |
|------------|--------------------------------------------------|
| `docs:`    | New or updated vault notes                       |
| `adr:`     | New or updated ADR                               |
| `schema:`  | Prisma schema change accompanied by a doc update |
| `diagram:` | Excalidraw diagram change                        |

Example: `docs: update CONTROL_PLANE_MODEL status to implemented`
