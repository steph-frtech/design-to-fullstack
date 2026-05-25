# dtfs-html-import

**Role**: Alternative entry point into the dtfs pipeline. Import HTML mockups or Figma exports and convert them into ScreenSpec records. The import is deterministic (no LLM calls server-side) and additive — it enriches or proposes corrections to existing ScreenSpecs without overwriting them.

## What it adds

| Asset | Path | Purpose |
|---|---|---|
| Command | `commands/import.md` | Analyze HTML, diff against existing ScreenSpec, produce a PlatformSpecProposal DRAFT |

## Reference document

Full pipeline details in [`docs/IMPORT.md`](../../docs/IMPORT.md):
- `dtfs__analyze_html` — deterministic structural parse
- `dtfs__diff_html_against_screen_spec` — compare to existing ScreenSpec
- `dtfs__html_analysis_to_proposal` — produce ProposalContents

## Dependencies

- `dtfs-core`
- `dtfs-natural-spec` (for the `dtfs-screen-spec-writer` agent used in enrichment)

## Usage

```
/dtfs/import path="mockups/dashboard.html"
```
