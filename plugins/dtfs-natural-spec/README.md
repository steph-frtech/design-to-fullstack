# dtfs-natural-spec

**Role**: Turns natural language app/screen descriptions into structured spec records (ProductSpec, ScreenSpec, ClarificationItem). Covers Phases 1–3 of the dtfs pipeline.

## What it adds

| Asset | Path | Purpose |
|---|---|---|
| Agent | `agents/dtfs-product-analyst.md` | Phase 1 — captures app description into ProductSpec |
| Agent | `agents/dtfs-screen-spec-writer.md` | Phase 2 — captures one screen's functional intent into ScreenSpec |
| Agent | `agents/dtfs-question-manager.md` | Phase 3 — resolves OpenQuestion / Assumption rows |
| Command | `commands/describe-app.md` | Invoke product analyst on a prose description |
| Command | `commands/describe-screen.md` | Invoke screen spec writer on a screen description |
| Command | `commands/questions.md` | Invoke question manager to resolve open items |
| Command | `commands/clarify.md` | Alias for questions — resolves clarification items interactively |

## Dependencies

- `dtfs-core` (MCP server must be registered)

## Usage flow

```
/dtfs/describe-app "A SaaS for tracking freelance invoices"
/dtfs/describe-screen "The invoice list screen with filters by status"
/dtfs/questions
```
