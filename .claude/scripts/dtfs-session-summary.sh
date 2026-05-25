#!/usr/bin/env bash
# dtfs-session-summary.sh — Stop hook (OPT-IN)
#
# NOT registered by default. Add to settings.local.json to enable.
# This script is SEPARATE from audit.sh (which is already registered).
# Purpose: emit a brief dtfs-specific session summary when the Claude Code
# session ends (what pipeline phases were touched, any open gates).
#
# Output: informational only (exit 0 always).
# Note: runs AFTER audit.sh in the Stop hook chain if both are registered.

set -euo pipefail

# Stop hooks receive session context on stdin (tool call history / summary)
EVENT="$(cat)"

# Try to extract a count of dtfs__ tool calls from the session
DTFS_CALLS="$(printf '%s' "$EVENT" | jq -r '[.. | strings | select(startswith("dtfs__"))] | length' 2>/dev/null || echo "?")"

# Build a concise summary line
TS="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
MSG="DTFS session ended at ${TS}. dtfs__ tool calls this session: ${DTFS_CALLS}. Run /dtfs:status <projectId> to check project state."

jq -n --arg msg "$MSG" '{"message": $msg}'

exit 0
