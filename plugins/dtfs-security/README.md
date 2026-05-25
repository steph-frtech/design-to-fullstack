# dtfs-security

**Role**: Governance, defense-in-depth ChangeSet guard, DeltaSpec validation. Ensures spec correctness before apply, and blocks unsafe apply calls that bypass the ChangeSet gate.

## What it adds

| Asset | Path | Purpose |
|---|---|---|
| Agent | `agents/dtfs-spec-validator.md` | Validate a DeltaSpec, operation, policy rule, or expression (read-only MCP tools) |
| Command | `commands/validate.md` | Invoke spec validator on any spec artifact |
| Hook | `hooks/dtfs-guard-apply.sh` | PreToolUse guard: blocks apply_spec / apply_delta_spec without a changeSetId |

## Reference document

Governance policy in [`docs/GOVERNANCE.md`](../../docs/GOVERNANCE.md).

## Hook registration

Note: if `dtfs-core` is already installed, the guard hook is already registered. Installing `dtfs-security` standalone also provides the hook:

```json
{
  "hooks": {
    "PreToolUse": [
      { "command": "bash .claude/hooks/dtfs-guard-apply.sh" }
    ]
  }
}
```

## MCP tools used (read-only)

- `dtfs__validate_delta_spec`
- `dtfs__validate_operation`
- `dtfs__validate_policy_rule`
- `dtfs__validate_expression`

## Dependencies

- `dtfs-core` (guard hook is also in dtfs-core; dtfs-security adds the explicit validator agent)

## Usage

```
/dtfs/validate spec="path/to/delta-spec.yaml"
```
