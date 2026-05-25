# Hooks

Les hooks Claude Code enregistrés (ou disponibles) pour le harness DTFS. État réel : 2/4 actifs, 2 scripts opt-in non enregistrés.

Liens : [[SAFETY_RULES]] · [[AGENTS_OVERVIEW]] · [[../09_ADR/ADR-0003-use-changesets]].

## Source of truth

`.claude/settings.json` (project settings, généré) · `.claude/settings.local.json` (user-local, hooks actifs) · `.claude/scripts/dtfs-*.sh`.

## AI usage

Les hooks sont transparents pour les agents — ils s'exécutent automatiquement avant/après les tool calls. Les agents n'ont pas besoin de les invoquer explicitement.

## Status

2/4 hooks actifs. 2 scripts scriptés mais non enregistrés par défaut.

---

## Hooks actifs (enregistrés)

### 1. PreToolUse — `dtfs-guard-apply.sh`

**Déclencheur :** Toute invocation des outils `dtfs__apply_spec`, `dtfs__apply_delta_spec`, `mcp__dtfs__apply_spec`, `mcp__dtfs__apply_delta_spec`.

**Comportement :** Vérifie que l'input contient un `changeSetId`. Si absent, **bloque** l'appel avec un message explicatif.

**Objectif :** Défense en profondeur — le serveur enforce déjà ce gate au runtime, ce hook est la deuxième couche côté Claude Code.

**Fichier :** `.claude/scripts/dtfs-guard-apply.sh`

**État :** Actif — enregistré dans `.claude/settings.local.json`.

---

### 2. Stop — `audit.sh`

**Déclencheur :** Fin de chaque session Claude Code (hook `Stop`).

**Comportement :** Lance `npx ecc-agentshield scan` contre `.claude/`. Audit de sécurité automatique du dossier de configuration.

**Fichier :** `.claude/scripts/audit.sh` (généré par `claude-code-up`)

**État :** Actif — enregistré dans `.claude/settings.json`.

---

## Hooks opt-in (scripts disponibles, non enregistrés)

Ces hooks sont disponibles mais nécessitent une activation manuelle dans `.claude/settings.local.json`.

### 3. UserPromptSubmit — `dtfs-detect-input.sh`

**Déclencheur :** Chaque soumission de prompt utilisateur.

**Comportement :** Détecte si le prompt ressemble à une description d'app ou d'écran (ou contient une URL Figma / HTML) et **suggère** la commande `/dtfs:*` appropriée. Informationnel uniquement — ne bloque jamais.

**Fichier :** `.claude/scripts/dtfs-detect-input.sh`

**État :** Opt-in. Pour activer, ajouter dans `settings.local.json` :
```json
"UserPromptSubmit": [{"matcher": "", "hooks": [{"type": "command", "command": ".claude/scripts/dtfs-detect-input.sh"}]}]
```

---

### 4. PostToolUse — `dtfs-commit-summary.sh`

**Déclencheur :** Après un appel réussi à `dtfs__commit_changeset` ou `mcp__dtfs__commit_changeset`.

**Comportement :** Émet un résumé one-line avec le `changeSetId` et un rappel de la commande revert.

**Fichier :** `.claude/scripts/dtfs-commit-summary.sh`

**État :** Opt-in. Pour activer :
```json
"PostToolUse": [{"matcher": "dtfs__commit_changeset|mcp__dtfs__commit_changeset", "hooks": [{"type": "command", "command": ".claude/scripts/dtfs-commit-summary.sh"}]}]
```

---

### 5. Stop — `dtfs-session-summary.sh` (addon)

**Déclencheur :** Fin de session (s'ajoute au Stop array existant avec `audit.sh`).

**Comportement :** Émet un résumé DTFS de la session (ChangeSets committés, artefacts créés).

**Fichier :** `.claude/scripts/dtfs-session-summary.sh`

**État :** Opt-in. Ajouter comme second entry dans le tableau `Stop` de `settings.local.json`.

---

## Récapitulatif

| Hook type | Script | État | Bloquant |
|-----------|--------|------|---------|
| PreToolUse | `dtfs-guard-apply.sh` | Actif | Oui (si pas de changeSetId) |
| Stop | `audit.sh` | Actif | Non |
| UserPromptSubmit | `dtfs-detect-input.sh` | Opt-in | Non |
| PostToolUse | `dtfs-commit-summary.sh` | Opt-in | Non |
| Stop | `dtfs-session-summary.sh` | Opt-in | Non |

**Audit P1 :** Enregistrer `dtfs-detect-input` et `dtfs-commit-summary` si souhaité (améliore l'expérience DX sans risque).
