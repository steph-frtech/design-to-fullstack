# 02 — Natural Language to Codegen

> Status: stable

## What this diagram shows

The full spec pipeline from free-text input to generated code, laid out left→right then top→bottom.

**Top row (Layers 0–2):**
- Natural App Description → ProductSpec → ScreenSpec

**Right column (Layers 3–8, going down):**
- Requirements → PlatformSpecProposal → DeltaSpec → ChangeSet

**Bottom row (Layers 8–9, going left):**
- ChangeSet → Contracts → Generated Code

## Steps in detail

| Step | Layer | Who does it |
|------|-------|-------------|
| Natural App Description | 0 | User / Claude Code |
| ProductSpec | 1 | dtfs-product-analyst agent |
| ScreenSpec | 2 | dtfs-screen-spec-writer agent |
| Requirements | 5 | dtfs-requirement-extractor agent |
| PlatformSpecProposal | 5 | dtfs-platform-mapper agent |
| DeltaSpec | 6 | compileProposalToDelta() |
| ChangeSet | 8 | applyDeltaSpec() + commitChangeSet() |
| Contracts | 9a | compileBackendContract / compileFrontendContract / compileSharedContract |
| Generated Code | 9b | emit-hono / emit-next / emit-prisma / emit-shared-sdk |

## Related notes

- [[EXECUTION_FLOW]] — full layer walk-through
- [[DELTA_SPEC]] — DeltaSpec format
- [[CHANGESET_FLOW]] — ChangeSet lifecycle
- [[RUNTIME_CONTRACTS_OVERVIEW]] — contracts layer
