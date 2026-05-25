# HARNESS.md — Claude Code Cockpit for design-to-fullstack

This document describes the Claude Code tooling layer that pilots the full
design-to-fullstack pipeline from a Claude Code session.

---

## Agents

All agents live in `.claude/agents/`. Each agent has a focused role and a
curated set of MCP tools. Invoke them via slash commands or explicitly with
`@agent-name`.

### Pre-existing agents

| Agent | Phase | Role |
|---|---|---|
| `dtfs-product-analyst` | 1 | Turns a natural-language description into a `ProductSpec` |
| `dtfs-screen-spec-writer` | 2 | Extracts a `ScreenSpec` from a screen/UI description or design artifact |
| `dtfs-question-manager` | 3 | Resolves `OpenQuestion` and `Assumption` rows via user dialogue |
| `dtfs-sdd-writer` | 4 | Generates Spec Kit Markdown artifacts (constitution, spec, plan, tasks, …) |
| `dtfs-sdd-reviewer` | 4 | Cross-checks SDD artifacts against ProductSpec + ScreenSpec |
| `dtfs-requirement-extractor` | 5 | Extracts `Requirement` rows from SDD + ProductSpec |
| `dtfs-platform-mapper` | 5–6 | Maps Requirements to Control Plane targets; produces `PlatformSpecProposal` |

### New agents (added in Step 15)

| Agent | Phase | Role |
|---|---|---|
| `dtfs-spec-writer` | 7 | Materializes an ACCEPTED `PlatformSpecProposal` into a validated `DeltaSpec`. Does NOT apply. |
| `dtfs-spec-validator` | any | Read-only validation of DeltaSpec, operations, policy rules, expressions, proposals |
| `dtfs-diff-explainer` | any | Explains ChangeSets and DeltaSpec diffs in plain language |

---

## Slash commands — `/dtfs:*` namespace

The `.claude/commands/dtfs/` directory provides the `/dtfs:` prefix.
All commands accept `$ARGUMENTS` (projectId, featureKey, ids, etc.).

### Pipeline commands (in order)

| Command | Phase | What it does |
|---|---|---|
| `/dtfs:describe-app` | 1 | Invokes `dtfs-product-analyst` to capture a `ProductSpec` |
| `/dtfs:describe-screen` | 2 | Invokes `dtfs-screen-spec-writer` to capture a `ScreenSpec` |
| `/dtfs:questions` | 3 | Invokes `dtfs-question-manager` to resolve OPEN questions + assumptions |
| `/dtfs:generate-spec` | 4 | Invokes `dtfs-sdd-writer` to produce SDD artifacts for a feature |
| `/dtfs:map-to-platform` | 5 | Invokes `dtfs-platform-mapper` (mapping pass only) |
| `/dtfs:propose` | 6 | Invokes `dtfs-platform-mapper` (proposal synthesis) → produces `DRAFT` |
| `/dtfs:validate` | 6–7 | Invokes `dtfs-spec-validator` on any artefact (delta, op, policy, expr) |
| `/dtfs:apply` | 7 | Runs begin → apply_delta_spec → commit ChangeSet (requires confirmation) |
| `/dtfs:revert` | any | Calls `dtfs__revert_changeset` or `dtfs__revert_field` |
| `/dtfs:status` | any | Aggregates gates + proposals + recent ChangeSets into a dashboard |

### Legacy flat commands (kept as-is)

The following flat commands in `.claude/commands/` are preserved additively:
`dtfs-clarify`, `dtfs-extract-requirements`, `dtfs-map-platform`,
`dtfs-product-spec`, `dtfs-propose-platform`, `dtfs-screen-spec`,
`dtfs-sdd-review`, `dtfs-sdd-write`.

---

## Hooks

### Active hook (registered in `settings.local.json`)

**`dtfs-guard-apply.sh` — PreToolUse**

Defense-in-depth guard for `apply_spec` / `apply_delta_spec`. If the tool
input does not contain a `changeSetId`, the hook blocks the call with an
explanatory message. The server already enforces this gate at runtime; this
hook is a second layer that prevents Claude from accidentally calling apply
without an open ChangeSet.

Registered for tools matching:
`dtfs__apply_spec|dtfs__apply_delta_spec|mcp__dtfs__apply_spec|mcp__dtfs__apply_delta_spec`

---

### Opt-in hooks (NOT registered by default)

The three hooks below are informational or intrusive for interactive sessions.
To activate one, copy the relevant snippet into `.claude/settings.local.json`
inside the `hooks` object.

#### `dtfs-detect-input.sh` — UserPromptSubmit

Detects if the user's prompt looks like an app or screen description (or
contains a Figma URL / HTML) and suggests the relevant `/dtfs:*` command.
Output is informational only (never blocks).

```json
"UserPromptSubmit": [
  {
    "matcher": "",
    "hooks": [
      {
        "type": "command",
        "command": ".claude/scripts/dtfs-detect-input.sh"
      }
    ]
  }
]
```

#### `dtfs-commit-summary.sh` — PostToolUse

After `dtfs__commit_changeset` succeeds, emits a one-line summary with the
changeSetId and a reminder of the revert command.

```json
"PostToolUse": [
  {
    "matcher": "dtfs__commit_changeset|mcp__dtfs__commit_changeset",
    "hooks": [
      {
        "type": "command",
        "command": ".claude/scripts/dtfs-commit-summary.sh"
      }
    ]
  }
]
```

#### `dtfs-session-summary.sh` — Stop (add alongside audit.sh)

Emits a brief dtfs-specific session summary when the Claude Code session
ends. Add it as a second entry in the `Stop` array — it runs after the
existing `audit.sh` entry from `settings.json`.

Add to `settings.local.json` (the Stop array merges with settings.json):

```json
"Stop": [
  {
    "matcher": "",
    "hooks": [
      {
        "type": "command",
        "command": ".claude/scripts/dtfs-session-summary.sh"
      }
    ]
  }
]
```

---

## Full end-to-end flow

```
User describes the app
        |
        v
/dtfs:describe-app <projectId>
  → dtfs-product-analyst
  → ProductSpec created + validated
        |
        v
/dtfs:describe-screen <projectId>  (repeat per screen)
  → dtfs-screen-spec-writer
  → ScreenSpec created + validated
        |
        v
/dtfs:questions <projectId>
  → dtfs-question-manager
  → all OPEN questions answered / deferred
  → clarification gate: blocked: false
        |
        v
/dtfs:generate-spec <projectId> <featureKey>
  → dtfs-sdd-writer
  → constitution + spec + plan + tasks created
        |
        v
  (optional) dtfs-sdd-reviewer: cross-check consistency
        |
        v
  dtfs-requirement-extractor: extract Requirement rows
        |
        v
/dtfs:map-to-platform <projectId> [featureKey]
  → dtfs-platform-mapper (mapping pass)
  → RequirementMapping rows created
  → coverage gate checked
        |
        v
/dtfs:propose <projectId> [featureKey]
  → dtfs-platform-mapper (proposal synthesis)
  → PlatformSpecProposal DRAFT created
        |
        v
User reviews the proposal
  → dtfs__accept_platform_proposal(proposalId)
        |
        v
/dtfs:validate proposal:<proposalId>
  → dtfs-spec-validator
  → verdict: VALID | WARNINGS | BLOCKED
        |
        v  (only if VALID or WARNINGS reviewed)
dtfs-spec-writer (invoked by /dtfs:apply pre-flight)
  → DeltaSpec created from proposal
  → validated + explained
        |
        v
/dtfs:apply <projectId> <deltaSpecId>
  → [dtfs-guard-apply.sh gate]
  → begin_changeset → apply_delta_spec → commit_changeset
  → ChangeSet COMMITTED
        |
        v
/dtfs:status <projectId>
  → gates + proposals + recent ChangeSets dashboard
        |
        v  (if mistake)
/dtfs:revert <changeSetId>
  → ChangeSet REVERTED
```

---

## ChangeSet gate

Every `apply_spec` / `apply_delta_spec` call MUST be wrapped in a
`begin_changeset` / `commit_changeset` pair. This is enforced at two levels:

1. **Server-side runtime** — the server rejects apply calls without an active
   ChangeSet.
2. **`dtfs-guard-apply.sh` hook** — blocks the Claude Code tool call if no
   `changeSetId` is present in the input (defense-in-depth).

The `/dtfs:apply` command enforces this by always calling `begin_changeset`
before `apply_delta_spec`.

To abandon an in-progress (OPEN) ChangeSet without committing:
`dtfs__discard_changeset(changeSetId)`.

---

## Key files

| Path | Purpose |
|---|---|
| `.claude/agents/dtfs-*.md` | Agent definitions |
| `.claude/commands/dtfs/*.md` | `/dtfs:*` slash commands |
| `.claude/commands/dtfs-*.md` | Legacy flat commands |
| `.claude/scripts/dtfs-guard-apply.sh` | PreToolUse hook (active) |
| `.claude/scripts/dtfs-detect-input.sh` | UserPromptSubmit hook (opt-in) |
| `.claude/scripts/dtfs-commit-summary.sh` | PostToolUse hook (opt-in) |
| `.claude/scripts/dtfs-session-summary.sh` | Stop hook (opt-in) |
| `.claude/settings.local.json` | User-local hook registration |
| `.claude/settings.json` | Project settings (generated — do not edit) |
| `docs/MCP_TOOLS.md` | Full MCP tool reference |
| `docs/DELTA_SPEC.md` | DeltaSpec DSL reference |
| `docs/CHANGESET_FLOW.md` | ChangeSet lifecycle |

---

## Runtime / Codegen agents & commands (Phase 26 — Step 27)

### Agents

| Agent | Phase | Role |
|---|---|---|
| `dtfs-runtime-architect` | 26 | Choisit et persiste le `RuntimeTarget` (stack versions, outputDir) via `dtfs__get_runtime_target` / `dtfs__set_runtime_target` |
| `dtfs-backend-contract-compiler` | 26 | Compile le `BackendContract` via `dtfs__compile_backend_contract`, valide et explique les erreurs |
| `dtfs-frontend-contract-compiler` | 26 | Compile le `FrontendContract` via `dtfs__compile_frontend_contract`, valide la cohérence |
| `dtfs-shared-contract-compiler` | 26 | Compile le `SharedContract` (Zod schemas, AppType) via `dtfs__compile_shared_contract` |
| `dtfs-hono-api-generator` | 26+ | Génère les routes Hono 4 depuis le BackendContract via `dtfs__generate_app` (granular `dtfs__generate_backend_api` — Phase 28 pending) |
| `dtfs-better-auth-generator` | 26+ | Génère `auth.ts` et le middleware Better Auth via `dtfs__generate_app` (granular `dtfs__generate_auth_runtime` — Phase 28 pending) |
| `dtfs-next16-generator` | 26+ | Génère les pages Next.js 16 App Router via `dtfs__generate_app` (granular `dtfs__generate_frontend_next` — Phase 28 pending) |
| `dtfs-sdk-generator` | 26+ | Génère le package SDK partagé via `dtfs__generate_app` (granular `dtfs__generate_shared_sdk` — Phase 28 pending) |
| `dtfs-codegen-orchestrator` | 26 | Orchestre le pipeline complet : compile les 3 contrats → `dtfs__generate_app` (dry-run obligatoire) — agent derrière `/dtfs:generate-app` |
| `dtfs-generated-code-reviewer` | 26 | Audite le code généré : structure, fichiers protégés, TypeScript, heuristiques qualité (Read + Bash) |

### Slash commands `/dtfs:*` (Runtime / Codegen)

| Command | Phase | What it does |
|---|---|---|
| `/dtfs:set-runtime` | 26 | Invoque `dtfs-runtime-architect` — configure le RuntimeTarget |
| `/dtfs:compile-contracts` | 26 | Compile les 3 contrats dans l'ordre (shared→backend→frontend) + validate + explain |
| `/dtfs:explain-contracts` | 26 | Appelle `dtfs__explain_contracts` et affiche une explication lisible |
| `/dtfs:generate-backend` | 26+ | Invoque `dtfs-hono-api-generator` (dry-run par défaut, `--write` pour écrire) |
| `/dtfs:generate-auth` | 26+ | Invoque `dtfs-better-auth-generator` (dry-run par défaut) |
| `/dtfs:generate-frontend` | 26+ | Invoque `dtfs-next16-generator` (dry-run par défaut) |
| `/dtfs:generate-sdk` | 26+ | Invoque `dtfs-sdk-generator` (dry-run par défaut) |
| `/dtfs:generate-app` | 26 | **Point d'entrée principal.** Invoque `dtfs-codegen-orchestrator` — pipeline complet contracts → generate_app |
| `/dtfs:check-generated` | 26 | Invoque `dtfs-generated-code-reviewer` — structure, TypeScript, protections |
| `/dtfs:run-generated-tests` | 26+ | Lance vitest/jest dans le répertoire de sortie (granular `dtfs__run_generated_tests` — Phase 28 pending) |

### Flux `/dtfs:generate-app` (pipeline complet)

```
/dtfs:generate-app <projectId>
        |
        v
dtfs-codegen-orchestrator
        |
        ├── dtfs__get_project_spec         [pre-flight]
        ├── dtfs__get_runtime_target       [pre-flight — abort si absent]
        |
        ├── dtfs__compile_shared_contract  [types partagés en premier]
        ├── dtfs__compile_backend_contract [routes + auth]
        ├── dtfs__compile_frontend_contract[pages + bindings]
        ├── dtfs__validate_contracts       [cohérence — bloque si invalide]
        ├── dtfs__explain_contracts        [résumé lisible]
        |
        ├── dtfs__generate_app(dryRun=true)[plan : N fichiers, N lignes]
        ├── [confirmation utilisateur]
        └── dtfs__generate_app(dryRun=false)[écriture → outDir]
                |
                v
        /dtfs:check-generated <projectId> --out <dir>
                |
                v
        /dtfs:run-generated-tests <projectId> --out <dir>
```

### Phase 28 — Granular generation tools (pending)

Les tools suivants sont documentés dans `docs/MCP_TOOLS.md` section "Phase 26"
mais ne sont **pas encore implémentés**. Les agents ci-dessus les mentionnent
explicitement comme "Phase 28 pending" et utilisent `dtfs__generate_app` en
attendant :

- `dtfs__plan_codegen`
- `dtfs__generate_database_schema`
- `dtfs__generate_auth_runtime`
- `dtfs__generate_backend_api`
- `dtfs__generate_frontend_next`
- `dtfs__generate_shared_sdk`
- `dtfs__generate_tests`
- `dtfs__check_generated_project`
- `dtfs__typecheck_generated_project`
- `dtfs__run_generated_tests`
- `dtfs__diff_generated_artifacts`
