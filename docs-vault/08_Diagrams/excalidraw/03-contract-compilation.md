# 03 — Contract Compilation

> Status: design-doc (Phase 25–28 target)

## What this diagram shows

The contract compilation phase that sits between ChangeSet commit and Codegen.

**Top:**
- ProjectSpec (stable, post-ChangeSet commit)
- RuntimeTarget ("hono-next" — Hono ~4.12 + Next 16 + Better Auth + Prisma 7)

**Middle — three parallel contracts compiled:**
- BackendContract — entity schemas, Hono routes, policies, auth config
- FrontendContract — Next routes, pages, components, forms, data bindings
- SharedContract — TypeScript DTOs, Zod schemas, API client signatures, error types

**Gate:**
- `validateContracts()` — all three contracts must pass before any file is written

**Bottom:**
- Codegen — emitters read contracts, not the Control Plane directly

## Why this matters

Without this indirection, changing Hono to Fastify would require touching emitters that know too much about both the spec model and the framework. The contracts layer decouples them.

## Related notes

- [[RUNTIME_CONTRACTS_OVERVIEW]] — full design doc
- [[BACKEND_CONTRACT]] — BackendContract schema
- [[FRONTEND_CONTRACT]] — FrontendContract schema
- [[SHARED_CONTRACT]] — SharedContract schema
- [[CONTRACT_VALIDATION]] — validation rules
