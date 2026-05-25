# dtfs Plugins

The design-to-fullstack harness is distributed as a set of Claude Code plugins. Each plugin is a self-contained directory under `plugins/` with a `.claude-plugin/plugin.json` manifest and sub-directories for agents, commands, and hooks.

Reference: [`plugins/.claude-plugin/marketplace.json`](../plugins/.claude-plugin/marketplace.json)

---

## Plugin graph (dependency order)

```
dtfs-core  ←  required by all plugins below
   ├── dtfs-natural-spec   (Phases 1–3)
   │      └── dtfs-speckit  (Phases 4–6)
   │             ├── dtfs-html-import  (alternative Phase 2 entry)
   │             ├── dtfs-history      (revert, diff, audit)
   │             ├── dtfs-behaviors    (behavior expansion)
   │             └── dtfs-codegen      (Phase 9 generation)
   └── dtfs-security  (validation + guard, usable standalone)
```

`dtfs-core` is a hard prerequisite. All other plugins are optional and composable.

---

## Plugins

### dtfs-core

**Role**: Foundational plugin. Provides the transversal `status` and `apply` commands, the ChangeSet guard hook (defense-in-depth), and the MCP server registration pointer.

**Contents**:
- `commands/status.md` — display project state (gates, ChangeSets, proposals)
- `commands/apply.md` — apply a DeltaSpec via a ChangeSet (Phase 7)
- `hooks/dtfs-guard-apply.sh` — PreToolUse hook blocking `apply_spec` without a `changeSetId`

**Dependencies**: none

---

### dtfs-natural-spec

**Role**: Phases 1–3. Turns natural-language app/screen descriptions into structured ProductSpec and ScreenSpec records. Resolves OpenQuestion and Assumption rows.

**Contents**:
- `agents/dtfs-product-analyst.md` — Phase 1 ProductSpec
- `agents/dtfs-screen-spec-writer.md` — Phase 2 ScreenSpec
- `agents/dtfs-question-manager.md` — Phase 3 clarification resolution
- `commands/describe-app.md`, `commands/describe-screen.md`, `commands/questions.md`, `commands/clarify.md`

**Dependencies**: `dtfs-core`

---

### dtfs-speckit

**Role**: Phases 4–6. Generates Spec Kit SDD artifacts (constitution, spec, plan, tasks), extracts traceable Requirements, maps them to Control Plane targets, and synthesizes a PlatformSpecProposal.

**Contents**:
- `agents/dtfs-sdd-writer.md` — Phase 4 SDD artifact generation
- `agents/dtfs-sdd-reviewer.md` — Phase 4 SDD artifact review
- `agents/dtfs-platform-mapper.md` — Phases 5–6 mapping and proposal
- `agents/dtfs-requirement-extractor.md` — Phase 5 requirement extraction
- `commands/generate-spec.md`, `commands/map-to-platform.md`, `commands/propose.md`, `commands/extract-requirements.md`, `commands/sdd-write.md`, `commands/sdd-review.md`

**Dependencies**: `dtfs-core`, `dtfs-natural-spec`

---

### dtfs-html-import

**Role**: Alternative Phase 2 entry point. Import HTML mockups or Figma exports into ScreenSpec format. Deterministic structural parse, diffed against existing ScreenSpec, produces a PlatformSpecProposal DRAFT.

**Contents**:
- `commands/import.md` — analyze HTML, diff, produce proposal

Reference: `docs/IMPORT.md`

**Dependencies**: `dtfs-core`, `dtfs-natural-spec`

---

### dtfs-history

**Role**: ChangeSet history, human-readable diff explanations, and revert capabilities.

**Contents**:
- `agents/dtfs-diff-explainer.md` — explain what changed between two ChangeSets
- `commands/revert.md` — revert a committed ChangeSet or individual field

Reference: `docs/CHANGESET_FLOW.md`, `docs/CHANGESET_AUDIT.md`

**Dependencies**: `dtfs-core`

---

### dtfs-behaviors

**Role**: Reference for the behavior expansion system. Behaviors are high-level macros (ownable, auditable, softDeletable, publishable, taggable, searchable) that expand into canonical DeltaSpec artifacts.

**Contents**: README only (documentation-only plugin; no agents or commands)

Reference: `docs/BEHAVIORS.md`

**Dependencies**: `dtfs-core`, `dtfs-speckit`

---

### dtfs-codegen

**Role**: Reference and contract for the deterministic code generation system. Reads the Control Plane spec and emits a skeleton Hono + Prisma + Next.js application.

**Contents**: README only (documentation-only plugin; invoked via `dtfs__generate_app` MCP tool)

Reference: `docs/CODEGEN.md`, `docs/CODEGEN_CONTRACT.md`

**Dependencies**: `dtfs-core` (committed ChangeSet required)

---

### dtfs-security

**Role**: Governance, defense-in-depth ChangeSet guard, DeltaSpec validation. Ensures spec correctness before apply and blocks unsafe apply calls.

**Contents**:
- `agents/dtfs-spec-validator.md` — validate DeltaSpec, operations, policies (read-only)
- `commands/validate.md` — invoke spec validator
- `hooks/dtfs-guard-apply.sh` — PreToolUse guard (same as dtfs-core; standalone installable)

Reference: `docs/GOVERNANCE.md`

**Dependencies**: `dtfs-core`

---

## Installing a plugin

Copy the plugin directory into your project's `.claude/` tree and merge the assets:

```bash
# Example: install dtfs-core into a new project
cp -r plugins/dtfs-core/commands/* .claude/commands/dtfs/
cp -r plugins/dtfs-core/hooks/* .claude/scripts/
```

Register the guard hook in `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      { "command": "bash .claude/scripts/dtfs-guard-apply.sh" }
    ]
  }
}
```

Register the MCP server in `.mcp.json`:

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

## Using the marketplace

The marketplace manifest at `plugins/.claude-plugin/marketplace.json` lists all 8 plugins with their relative paths. A future `claude-code-up` integration can auto-discover and install plugins from this manifest.

To list available plugins:

```bash
jq '.plugins[] | {name, description}' plugins/.claude-plugin/marketplace.json
```

---

## speckit-dtfs extension

`plugins/speckit-dtfs/` is a Spec Kit extension (not a Claude Code plugin). It adds 4 templates to your Spec Kit workflow:

| Template | File | Purpose |
|---|---|---|
| `platform-mapping` | `platform-mapping.md` | Map Requirements to Control Plane targets |
| `delta-spec` | `delta-spec.md` | Produce a canonical DeltaSpec (skeleton + checklist) |
| `control-plane-checklist` | `control-plane-checklist.md` | Pre-apply gate checklist |
| `dtfs-codegen-contract` | `dtfs-codegen-contract.md` | Codegen contract and guarantees |

### Installing speckit-dtfs

Copy the extension directory into your project's `.speckit/extensions/`:

```bash
cp -r plugins/speckit-dtfs .speckit/extensions/speckit-dtfs
```

Then reference it in your Spec Kit configuration:

```json
{ "extensions": ["speckit-dtfs"] }
```

Reference: `plugins/speckit-dtfs/extension.json`

---

## Related docs

- `docs/HARNESS.md` — full pipeline overview (Phases 1–9)
- `docs/DELTA_SPEC.md` — DeltaSpec canonical format
- `docs/SPECKIT_INTEGRATION.md` — Spec Kit integration details
- `docs/GOVERNANCE.md` — governance policy
- `docs/BEHAVIORS.md` — behavior expansion table
- `docs/CODEGEN.md` — codegen implementation
- `docs/CHANGESET_FLOW.md` — ChangeSet flow
