# dtfs-core

**Role**: Foundational plugin for the design-to-fullstack (dtfs) harness. Provides the transversal `status` and `apply` commands, the ChangeSet guard hook (defense-in-depth), and the MCP server registration pointer.

**Required by**: all other `dtfs-*` plugins.

## What it adds

| Asset | Path | Purpose |
|---|---|---|
| Command | `commands/status.md` | Display full project state: gates, last ChangeSets, active proposals |
| Command | `commands/apply.md` | Apply a DeltaSpec via a ChangeSet (Phase 7 — irreversible without revert) |
| Hook | `hooks/dtfs-guard-apply.sh` | PreToolUse guard: blocks `apply_spec` / `apply_delta_spec` if no `changeSetId` present |

## MCP server

Register the dtfs MCP server in your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "dtfs": {
      "command": "pnpm",
      "args": ["--filter", "backend", "mcp"],
      "env": {}
    }
  }
}
```

## Hook registration

Add to `.claude/settings.json` or `.claude/settings.local.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      { "command": "bash .claude/hooks/dtfs-guard-apply.sh" }
    ]
  }
}
```

## Dependencies

None. This is the base plugin.
