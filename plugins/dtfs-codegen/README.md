# dtfs-codegen

**Role**: Reference and documentation for the deterministic code generation system. The codegen pass reads the Control Plane spec and emits a skeleton full-stack application (Hono backend + Prisma schema + Next.js frontend). No command or agent shipped — generation is invoked via MCP tool after a DeltaSpec is applied.

## What it adds

This plugin is documentation-only (no agents or commands shipped). It provides the reference contract for what the codegen produces and guarantees.

## Reference documents

- [`docs/CODEGEN.md`](../../docs/CODEGEN.md) — overview and what the codegen reads/emits
- [`docs/CODEGEN_CONTRACT.md`](../../docs/CODEGEN_CONTRACT.md) — guarantees: deterministic, traceability, what is and is not generated

## MCP tool used

- `dtfs__generate_app` — reads the Control Plane spec of a project and writes a skeleton app to an output directory

## What the codegen guarantees

- **Deterministic**: same spec + same codegen version = byte-identical output
- **Well-formed stubs**: generated code compiles but is not a production implementation
- **Traceability**: every generated file is annotated with its source spec artifact (Entity, Operation, Screen)
- **Not a running app**: stubs require human completion for business logic

## Dependencies

- `dtfs-core`
- A committed DeltaSpec (ChangeSet in `COMMITTED` status) must exist before invoking generate_app
