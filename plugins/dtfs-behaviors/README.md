# dtfs-behaviors

**Role**: Reference and documentation for the behavior expansion system. Behaviors are high-level macros attached to Entities that expand into canonical DeltaSpec artifacts (Attributes, Relations, Operations, Policies, TestScenarios). No command is provided — behaviors are invoked via MCP tools or the apply pipeline.

## What it adds

This plugin is documentation-only (no agents or commands shipped). It provides the reference to enable correct usage of behavior expansion in other plugins.

## Reference document

Full expansion table and DSL in [`docs/BEHAVIORS.md`](../../docs/BEHAVIORS.md):
- Built-in behaviors: `ownable`, `auditable`, `softDeletable`, `publishable`, `taggable`, `searchable`
- Expansion is always dry-run until explicitly applied

## MCP tools used

- `dtfs__expand_behaviors` — expands behaviors into a DeltaSpec (dry-run)
- `dtfs__list_behaviors` — list available built-in behaviors

## Usage pattern

Behaviors are referenced in PlatformSpecProposal YAML or passed directly to `dtfs__expand_behaviors`. After expansion, the resulting DeltaSpec is reviewed and applied via `dtfs-core`'s apply command.

## Dependencies

- `dtfs-core`
- `dtfs-speckit` (behaviors typically applied after a PlatformSpecProposal is accepted)
