---
description: Import an HTML mockup or design export and create/enrich a ScreenSpec from it.
---

Provide an HTML string or file path. The command analyses the structure deterministically (no LLM server-side), diffs it against any existing ScreenSpec for the same screen, and produces a PlatformSpecProposal DRAFT (Phase 6 format).

**Steps:**
1. Call `dtfs__analyze_html` with the HTML string to get a structural analysis.
2. If a ScreenSpec exists for the target screen, call `dtfs__diff_html_against_screen_spec` to compute a diff.
3. Call `dtfs__html_analysis_to_proposal` to produce a ProposalContents.
4. The agent `dtfs-screen-spec-writer` may be invoked to enrich the ScreenSpec with semantic intent from the import.

See `docs/IMPORT.md` for the full pipeline reference.
