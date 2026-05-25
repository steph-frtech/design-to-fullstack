# dtfs-speckit

**Role**: Spec Kit SDD artifact generation (Phase 4) and platform mapping pipeline (Phases 5–6). Writes constitution, spec, plan, and tasks markdown files; extracts traceable Requirements; maps Requirements to Control Plane targets; synthesizes a PlatformSpecProposal.

## What it adds

| Asset | Path | Purpose |
|---|---|---|
| Agent | `agents/dtfs-sdd-writer.md` | Phase 4 — generates SDD artifacts (constitution, spec, plan, tasks) |
| Agent | `agents/dtfs-sdd-reviewer.md` | Phase 4 — cross-checks SDD artifacts against ProductSpec + ScreenSpecs |
| Agent | `agents/dtfs-platform-mapper.md` | Phases 5–6 — maps Requirements to Control Plane, proposes PlatformSpecProposal |
| Agent | `agents/dtfs-requirement-extractor.md` | Phase 5 — extracts Requirements from spec.md + tasks.md |
| Agent | `agents/dtfs-spec-writer.md` | Phase 7 — turns an ACCEPTED PlatformSpecProposal into a validated DeltaSpec |
| Command | `commands/generate-spec.md` | Invoke SDD writer for a feature |
| Command | `commands/map-to-platform.md` | Invoke platform mapper (Phase 5) |
| Command | `commands/propose.md` | Invoke platform mapper in proposal mode (Phase 6) |
| Command | `commands/extract-requirements.md` | Extract Requirements from SDD artifacts |
| Command | `commands/sdd-write.md` | Alias for generate-spec |
| Command | `commands/sdd-review.md` | Invoke SDD reviewer |

## Dependencies

- `dtfs-core`
- `dtfs-natural-spec` (ProductSpec + ScreenSpec must exist before Phase 4)

## Usage flow

```
/dtfs/generate-spec feature="user authentication"
/dtfs/extract-requirements
/dtfs/map-to-platform
/dtfs/propose
```
