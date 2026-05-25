# Architecture

Design-to-fullstack is a meta-platform that converts a natural-language
description of an app into a fully generated, deployable full-stack
application. The platform is structured around **two planes** and a
**10-layer execution pipeline**.

## Two planes

```
┌──────────────────────────────────────────────┐
│   Control Plane  (schema dtfs)               │
│                                              │
│   Stores DEFINITIONS — Project, Entity,      │
│   Resource, Operation, Policy, etc.          │
│                                              │
│   This is what the user / LLM manipulates.   │
└──────────────────────────────────────────────┘
                  │
                  │  compile()    ← layer 9
                  ▼
┌──────────────────────────────────────────────┐
│   Generated App N   (schema gen_<slug>)      │
│                                              │
│   Real Postgres tables, FK, RLS              │
│   Real Hono API, Prisma client, Next pages   │
│                                              │
│   V3 stack target:                           │
│     • DoltPostgres (branches, time-travel)   │
│     • Temporal (Operation kind=WORKFLOW)     │
└──────────────────────────────────────────────┘
```

The Control Plane is **always** the source of truth. Generated Apps are
disposable artifacts — re-running codegen from the same Control Plane
state must produce equivalent code.

## The 10-layer pipeline

```
0. Natural Input Layer       NL prompts + HTML + Figma exports
1. Product Understanding     ProductSpec (purpose, personas, goals, glossary)
2. Screen Understanding      ScreenSpec (fields, actions, dataNeeds, states)
3. Clarification             OpenQuestion / Assumption / Conflict
4. Spec Kit                  SpecArtifact (constitution / spec / plan / tasks)
5. Platform Mapping          Requirement → RequirementMapping
6. DeltaSpec                 create[] / update[] / delete[]
7. Validation                validate_spec / validate_expr / validate_policy
8. ChangeSet                 group + commit / revert
9. Codegen                   GeneratedArtifact + DeploymentTarget
10. Test & Audit             TestScenario + AuditLog
```

The cardinal rule: **the LLM never goes `prompt → code` directly**. It
always passes through this pipeline.

## Where each layer lives

| Layer | Tables (Control Plane)                                       | Status            |
|-------|--------------------------------------------------------------|-------------------|
| 0     | none — input is transient                                    | not implemented   |
| 1     | `ProductSpec`                                                 | placeholder       |
| 2     | `ScreenSpec`                                                  | placeholder       |
| 3     | `OpenQuestion` · `Assumption`                                 | placeholder       |
| 4     | `SpecArtifact`                                                | placeholder       |
| 5     | `Requirement` · `RequirementMapping`                          | placeholder       |
| 6     | (no table — request body to apply_spec)                       | live (V1)         |
| 7     | (no table — validation endpoints)                             | live (V1)         |
| 8     | `ChangeSet` · `Revision`                                      | live (V1)         |
| 9     | `GeneratedArtifact` · `DeploymentTarget`                      | placeholder       |
| 10    | `TestScenario` · `AuditLog`                                   | placeholder       |

Plus the platform-wide concepts:
- **Data**: `Entity` · `Attribute` · `EntityRelation` · `EntityRecord` (live)
- **API**: `Resource` · `Operation` (live)
- **Auth/Security**: `Policy` · `AuthMethod` · `Secret` · `AppRole` (live · placeholder · placeholder · placeholder)
- **Behavior**: `Behavior` · `Workflow` (live · placeholder)
- **Integration**: `Integration` · `Trigger` · `EventDefinition` (live · live · placeholder)
- **UI**: `Screen` · `Component` · `Form` · `Field` · `FieldOption` · `Action` · `DataBinding` (live · live · live · live · live · placeholder · placeholder)
- **Files**: `Asset` (placeholder)
- **Config**: `Environment` (placeholder)

## Why this many concepts?

Because a real full-stack app has all of these surfaces. By naming each
explicitly and giving it a table, we:

1. Prevent the LLM from inventing structure ad hoc.
2. Make the spec inspectable, diffable, revertable.
3. Allow codegen (V3) to compile each concept to a known artifact.
4. Allow Spec Kit / Clarification layers to surface gaps explicitly.

V1 shipped the live concepts. Phase 0 reserves the seat for all the
placeholders. Phases 1+ flesh them out.

## Reading the rest

- `EXECUTION_FLOW.md` — concrete walk through of an app being built
- `BACKEND_MODEL.md` — reference for every concept
- `DELTA_SPEC.md` — apply_spec body format
- `EXPR_DSL.md`, `OPERATION_DSL.md`, `POLICY_DSL.md` — the three DSLs
- `SPECKIT_INTEGRATION.md` — how Spec Kit slots in
- `CODEGEN_CONTRACT.md` — what codegen consumes and produces
