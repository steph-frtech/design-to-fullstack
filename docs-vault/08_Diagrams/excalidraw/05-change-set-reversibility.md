# 05 — ChangeSet Reversibility

> Status: stable

## What this diagram shows

The full lifecycle of a ChangeSet and the two exits at each decision point.

**Happy path (top → commit):**
1. DeltaSpec — the JSON description of changes to apply
2. validate (optional) — static lint, no DB write
3. begin ChangeSet — opens a DRAFT
4. apply — writes rows, emits Revision records linked to the ChangeSet
5. commit — transitions DRAFT → APPLIED

**Abort path (apply → discard):**
- discard — deletes the DRAFT and all its Revisions (no trace left)

**Post-commit revert (commit → revert):**
- revert — creates a new inverse APPLIED ChangeSet; the original remains in history
- State machine: `DRAFT → APPLIED → REVERTED`

## Key invariants

- No open ChangeSet = no write (enforced by `changeset-middleware.ts`)
- Every mutation is attributed to a ChangeSet
- Revert is non-destructive: it creates a new ChangeSet rather than deleting the old one
- `getSpecAt(csId)` lets you inspect the spec state at any ChangeSet

## One-shot shortcut

`POST /api/projects/:id/delta-spec/apply` opens, applies and commits in a single call.

## Related notes

- [[CHANGESET_FLOW]] — full documentation with curl examples
- [[DELTA_SPEC]] — DeltaSpec format
- [[02-delta-spec-flow]] — mermaid flow diagram
