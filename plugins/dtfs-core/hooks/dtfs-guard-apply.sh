#!/usr/bin/env bash
# dtfs-guard-apply.sh — PreToolUse hook (defense-in-depth for apply_spec)
#
# Registered in settings.local.json as PreToolUse hook.
# Purpose: warn (and optionally block) if apply_spec / apply_delta_spec is
# called without an explicit changeSetId in the tool input, which is a sign
# that the ChangeSet gate may not have been respected.
#
# Protocol: reads the Claude Code hook event JSON from stdin.
# Exit codes:
#   0  — allow the tool call (or non-apply tool)
#   2  — block the tool call with a message to the model
#
# Output (when blocking): a JSON object on stdout with the decision.
# See: https://docs.anthropic.com/en/docs/claude-code/hooks

set -euo pipefail

# Read the full hook event from stdin
EVENT="$(cat)"

# Extract the tool name from the event JSON
TOOL_NAME="$(printf '%s' "$EVENT" | jq -r '.tool_name // .toolName // ""' 2>/dev/null || true)"

# Only guard apply tools
case "$TOOL_NAME" in
  dtfs__apply_spec|dtfs__apply_delta_spec|mcp__dtfs__apply_spec|mcp__dtfs__apply_delta_spec)
    ;;
  *)
    # Not an apply tool — allow immediately
    exit 0
    ;;
esac

# Check if the input contains a changeSetId (the ChangeSet gate signal)
CHANGESET_ID="$(printf '%s' "$EVENT" | jq -r '.tool_input.changeSetId // .tool_input.changeset_id // ""' 2>/dev/null || true)"

if [ -z "$CHANGESET_ID" ]; then
  # No changeSetId in the input — warn the model
  # Output a blocking decision with an explanatory message
  jq -n '{
    "decision": "block",
    "reason": "DTFS GUARD: apply_spec / apply_delta_spec requires an active ChangeSet (changeSetId). Call dtfs__begin_changeset first to open a ChangeSet, then retry. This is enforced server-side as well (defense-in-depth)."
  }'
  exit 2
fi

# changeSetId present — allow
exit 0
