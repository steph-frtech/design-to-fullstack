# dtfs-history

**Role**: ChangeSet history navigation, human-readable diff explanations, and revert capabilities. Allows understanding what changed between ChangeSets and rolling back committed ChangeSets.

## What it adds

| Asset | Path | Purpose |
|---|---|---|
| Agent | `agents/dtfs-diff-explainer.md` | Explain what changed between two ChangeSets, or describe a single ChangeSet/DeltaSpec in plain language |
| Command | `commands/revert.md` | Revert a committed ChangeSet or an individual field |

## Reference document

Full flow in [`docs/CHANGESET_FLOW.md`](../../docs/CHANGESET_FLOW.md) and audit trail in [`docs/CHANGESET_AUDIT.md`](../../docs/CHANGESET_AUDIT.md).

## MCP tools used

- `dtfs__revert_changeset` — revert an entire ChangeSet
- `dtfs__list_changesets` — list ChangeSet history
- `dtfs__get_changeset` — get a specific ChangeSet with its deltas

## Dependencies

- `dtfs-core`

## Usage

```
/dtfs/revert changeSetId="cs_abc123"
```
