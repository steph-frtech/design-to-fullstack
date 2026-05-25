# Spec Kit integration

[Spec Kit](https://github.com/githubnext/spec-kit) is a tooling kit by
GitHub Next for spec-driven development : it materializes a project's
intent into four Markdown artifacts (`constitution.md`, `spec.md`,
`plan.md`, `tasks.md`) that drive downstream code generation.

design-to-fullstack uses Spec Kit at **layer 4** of the pipeline. The
artifacts are stored as `SpecArtifact` rows scoped to a project.

## Why Spec Kit

The Control Plane is the *executable* model. Spec Kit is the *functional*
model — the artifacts a human reviews, debates, and signs off on before
anything compiles to code.

> Spec Kit formalizes **the what and the why**.
> The Control Plane formalizes **the how, generatable**.

Without Spec Kit, the LLM would jump from natural-language prose
directly to a DeltaSpec. With Spec Kit, the LLM first authors readable
Markdown artifacts that humans can verify.

## The four artifacts (mapped to `SpecArtifactKind`)

### `CONSTITUTION`

The project's invariant principles — non-functional priorities, design
philosophy, things that must remain true across iterations.

Example :
```markdown
# Constitution

- Privacy first : no PII leaves the user's device unencrypted.
- Sharing is optional : every list is private by default.
- Mobile-first responsive design.
- All actions must work offline-first, then sync.
```

The constitution rarely changes. It's the LLM's north star.

### `SPEC`

The functional specification — what the system does, who uses it, what
flows exist.

Example :
```markdown
# Spec — todo-list-multi-user

## Personas
- Solo planner
- Family organizer

## User stories
- As a Solo planner, I can create a private todo list.
- As a Family organizer, I can share a list by link with expiry.

## Acceptance criteria
- A todo can be added in < 3 seconds.
- A shared link works without account creation.
```

This is the artifact the user reviews most. Iterate here before going
further.

### `PLAN`

Technical plan — chosen architecture, stack, key trade-offs, milestones.

Example :
```markdown
# Plan

## Stack
- Frontend : Next.js 16, Tailwind, TanStack Query
- Backend : Hono + Prisma
- DB : Postgres (V1) → DoltPostgres (V3)
- Auth : Session-based (AuthMethod SESSION)

## Milestones
1. Schema + CRUD for TodoList/TodoItem
2. Share-link flow
3. Mobile-first UI pass
4. Codegen + deploy to Vercel
```

### `TASKS`

Ordered task list, each task small enough to be one Operation/Resource/
Screen creation or a clearly bounded change.

Example :
```markdown
# Tasks

- [ ] T1 Create Entity `TodoList` with attrs title, ownerId
- [ ] T2 Create Entity `TodoItem` with attrs listId, label, done
- [ ] T3 Create Resource `todo-lists`
- [ ] T4 Create Operation `createTodoList`
- [ ] T5 Create Policy `is-todo-list-owner`
- [ ] T6 Create Behavior `ownable` on TodoList
- [ ] T7 Create Screen `/lists` + Form `newTodoListForm`
- [ ] T8 Create ShareLink entity + createShareLink Operation
```

Each task maps cleanly to one or more entries in a DeltaSpec.

## Storage

```prisma
model SpecArtifact {
  id        String           @id @default(cuid())
  projectId String
  kind      SpecArtifactKind // CONSTITUTION | SPEC | PLAN | TASKS | NOTES
  body      String           // raw markdown
  version   Int              @default(1)
  createdAt DateTime         @default(now())
  updatedAt DateTime         @updatedAt
}
```

Versioning : `SpecArtifact` is NOT in the `VERSIONED_MODELS` Set in V1
(the artifacts version themselves via the `version` column). Each
substantive edit bumps the version + creates a new row, keeping the
history queryable without ChangeSet/Revision overhead.

## Flow

```
Layer 0 : user prompts "build a todo app"
   ↓
Layer 1 (LLM) : extract ProductSpec
   ↓
Layer 2 (LLM) : extract ScreenSpec[]
   ↓
Layer 3 (LLM + user) : resolve OpenQuestions, log Assumptions
   ↓
Layer 4 (LLM) : emit four SpecArtifact rows
   ↓ — user reviews + edits the Markdown directly —
Layer 5 (LLM) : Tasks → Requirements → RequirementMappings → DeltaSpec
   ↓
Layer 6+ : validate → ChangeSet → codegen
```

## Why we don't replace the Control Plane with Spec Kit

Spec Kit's artifacts are **prose** — they're readable but ambiguous.
The Control Plane is **typed JSON** — unambiguous, validable,
compilable.

The LLM uses Spec Kit to align with the user. Then it commits to the
Control Plane to actually produce code.

## What this looks like in V1

V1 ships only the `SpecArtifact` table — no auto-generation, no UI
viewer, no Spec-Kit CLI integration. The Phase 4 work will add :

- Endpoints to read/write SpecArtifact rows
- An LLM agent (`dtfs-spec-author`) that drafts the four artifacts
- A UI panel to view/edit the Markdown
- A `dtfs__publish_spec_artifact` MCP tool
- Optionally : a `spec-kit-bridge` CLI shim that imports an existing
  Spec Kit folder and writes the rows
