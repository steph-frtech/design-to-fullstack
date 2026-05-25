#!/usr/bin/env bash
# dtfs-commit-summary.sh — PostToolUse hook (OPT-IN)
#
# NOT registered by default. Add to settings.local.json to enable.
# Purpose: after dtfs__commit_changeset succeeds, emit a compact summary
# of what was applied (changeSetId, message, timestamp).
#
# Output: informational only (no blocking, exit 0 always).

set -euo pipefail

EVENT="$(cat)"

# Only act after commit_changeset
TOOL_NAME="$(printf '%s' "$EVENT" | jq -r '.tool_name // .toolName // ""' 2>/dev/null || true)"

case "$TOOL_NAME" in
  dtfs__commit_changeset|mcp__dtfs__commit_changeset)
    ;;
  *)
    exit 0
    ;;
esac

# Extract result fields if available
RESULT="$(printf '%s' "$EVENT" | jq -r '.tool_result // .result // {}' 2>/dev/null || true)"

CHANGESET_ID="$(printf '%s' "$RESULT" | jq -r '.changeSetId // .id // "unknown"' 2>/dev/null || echo "unknown")"
MESSAGE="$(printf '%s' "$RESULT" | jq -r '.message // ""' 2>/dev/null || true)"
STATUS="$(printf '%s' "$RESULT" | jq -r '.status // "COMMITTED"' 2>/dev/null || echo "COMMITTED")"
TS="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

SUMMARY="ChangeSet commité — id: ${CHANGESET_ID} | status: ${STATUS} | ${TS}"
if [ -n "$MESSAGE" ]; then
  SUMMARY="${SUMMARY} | message: ${MESSAGE}"
fi
SUMMARY="${SUMMARY} | Pour annuler : /dtfs:revert ${CHANGESET_ID}"

jq -n --arg msg "$SUMMARY" '{"message": $msg}'

exit 0
