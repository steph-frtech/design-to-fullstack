#!/usr/bin/env bash
# dtfs-detect-input.sh — UserPromptSubmit hook (OPT-IN)
#
# NOT registered by default. Add to settings.local.json to enable.
# Purpose: detect if the user's prompt looks like an app/screen description
# or a design artifact (Figma URL, HTML, image path) and suggest the
# relevant /dtfs:* slash command.
#
# Output: informational only (no blocking, exit 0 always).
# The suggestion is emitted as a JSON "message" to be shown to the model.

set -euo pipefail

EVENT="$(cat)"

# Extract the prompt text
PROMPT="$(printf '%s' "$EVENT" | jq -r '.prompt // .user_message // ""' 2>/dev/null || true)"

if [ -z "$PROMPT" ]; then
  exit 0
fi

PROMPT_LOWER="$(printf '%s' "$PROMPT" | tr '[:upper:]' '[:lower:]')"

SUGGESTION=""

# Figma / design link
if printf '%s' "$PROMPT_LOWER" | grep -qE '(figma\.com|fig\.figma|design|maquette|wireframe)'; then
  SUGGESTION="/dtfs:describe-screen — détecté : lien/fichier design. Pensez à joindre le projectId."

# HTML or JSX snippets
elif printf '%s' "$PROMPT_LOWER" | grep -qE '(<html|<div|<form|<button|jsx|tsx|react component)'; then
  SUGGESTION="/dtfs:describe-screen — détecté : balisage HTML/JSX. L'agent screen-spec-writer peut en extraire un ScreenSpec."

# App description keywords
elif printf '%s' "$PROMPT_LOWER" | grep -qE '(je veux (créer|faire|builder|développer)|application (de|pour)|app (de|pour)|plateforme (de|pour)|saas|marketplace)'; then
  SUGGESTION="/dtfs:describe-app — détecté : description d'application. Lancez ce slash command pour démarrer le pipeline."

# Screen description keywords
elif printf '%s' "$PROMPT_LOWER" | grep -qE '(écran|screen|page|vue|dashboard|formulaire|liste|table|modal|sidebar|composant)'; then
  SUGGESTION="/dtfs:describe-screen — détecté : description d'écran ou composant UI."
fi

if [ -n "$SUGGESTION" ]; then
  jq -n --arg msg "DTFS HINT: $SUGGESTION" '{"message": $msg}'
fi

exit 0
