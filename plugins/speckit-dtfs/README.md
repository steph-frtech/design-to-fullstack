# speckit-dtfs

**Type**: Spec Kit extension (not a Claude Code plugin)

**Role**: Adds four design-to-fullstack templates to the Spec Kit workflow, covering platform mapping, DeltaSpec production, control plane pre-apply gates, and codegen contract documentation.

## Templates

| Name | File | Purpose |
|---|---|---|
| `platform-mapping` | `platform-mapping.md` | Map Requirements to Control Plane targets (Entity, Operation, Policy, Screen, Behavior) |
| `delta-spec` | `delta-spec.md` | Skeleton + checklist for producing a canonical DeltaSpec from an accepted PlatformSpecProposal |
| `control-plane-checklist` | `control-plane-checklist.md` | Pre-apply gate checklist (validity, changeset, coverage, governance) |
| `dtfs-codegen-contract` | `dtfs-codegen-contract.md` | Contract specifying what the dtfs codegen consumes, produces, and guarantees |

## Install

Copy this directory into your project's `.speckit/extensions/`:

```bash
cp -r plugins/speckit-dtfs .speckit/extensions/speckit-dtfs
```

Reference templates in your Spec Kit configuration:

```json
{ "extensions": ["speckit-dtfs"] }
```

## Manifest

See `extension.json` for the full template registry and install instructions.
