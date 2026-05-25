# ChangeSet/Revision System — Conformance Audit

> Audit date: 2026-05-24  
> Reference: plan.md L187–221, docs/DELTA_SPEC.md

---

## 1. Required functions (plan.md) — Status matrix

| Function | Status | Location | Conforms to plan | Gap / Notes |
|---|---|---|---|---|
| `beginChangeSet` | PRESENT | `backend/src/mcp.ts:198` (tool `dtfs__begin_changeset`) + `backend/src/changesets.ts:45` (POST /) | Y | Creates DRAFT, returns id |
| `validateDeltaSpec` | PRESENT | `backend/src/lib/delta-spec-validation.ts:25` | Y | Static lint, no DB write. Called via MCP `dtfs__validate_delta_spec` and HTTP POST /delta-spec/validate |
| `applyDeltaSpec` | **ADDED** | `backend/src/lib/delta-spec-apply.ts` (new) | Y | Phase 11 — see section 3 |
| `commitChangeSet` | PRESENT | `backend/src/mcp.ts:211` (tool `dtfs__commit_changeset`) + `backend/src/changesets.ts:62` (POST /:csid/commit) | Y | Sets status APPLIED + appliedAt |
| `discardChangeSet` | PRESENT | `backend/src/mcp.ts:226` (tool `dtfs__discard_changeset`) + `backend/src/changesets.ts:78` (DELETE /:csid) | Y | Deletes row + Revisions. Only DRAFT. |
| `revertChangeSet` (bulk) | **ADDED** | `backend/src/lib/revert.ts` (added `revertChangeSet`) | Y | Phase 11 — iterates Revisions DESC, creates inverse CS |
| `revertRevision` (single) | PRESENT | `backend/src/lib/revert.ts:42` (`revertOne`) + MCP `dtfs__revert_revision` | Y | Full row inverse |
| `revertField` (field) | PRESENT | `backend/src/lib/revert.ts:151` (`revertField`) + MCP `dtfs__revert_field` | Y | Ultra-fine field revert |
| `getSpecAt` | **ADDED** | `backend/src/lib/spec-snapshot.ts` (new) | Partial (V1: Entities + Attributes + Operations only) | V2: remaining buckets |
| `diffChangeSets` | **ADDED** | `backend/src/lib/changeset-diff.ts` (new) | Y (V1 textual impl) | |

---

## 2. Mandatory flux conformance

Plan.md specifies: `begin_changeset → validate_spec → apply_spec → commit_changeset` (or `discard_changeset`).

| Step | Enforced? | Notes |
|---|---|---|
| `begin_changeset` | YES — explicit | Client calls POST /changesets or `dtfs__begin_changeset` |
| `validate_spec` | ADVISORY | No hard gate preventing apply without prior validate. The apply function runs Zod parse internally but does not require a prior validate call. Gap: documented below. |
| `apply_spec` | YES — `applyDeltaSpec` added in Phase 11 | |
| `commit_changeset` / `discard_changeset` | YES | Existing endpoints + MCP tools |

---

## 3. Gate: must have explicit ChangeSet to write

**Current behavior (IMPLICIT CS):** `backend/src/lib/changeset-middleware.ts` always creates an implicit ChangeSet for write requests (`POST/PUT/PATCH/DELETE`) that don't carry `X-ChangeSet-Id`. The implicit CS is auto-committed at the end of the request if at least one Revision was produced; otherwise it is discarded.

**Consequence:** There is NO hard gate of "must have explicit ChangeSet". Any write operation proceeds even without a pre-opened explicit ChangeSet.

**This is an intentional design choice** to allow lower-friction mutations. The middleware documents this as "implicit one-revision changeset". This does NOT violate plan.md — plan.md says the flux "begin → validate → apply → commit" is the recommended LLM workflow, not a hard API enforcement.

**Gap noted:** If strict explicit-only CS becomes a requirement, `changeset-middleware.ts` line 36–50 should be changed to return `400 missing_explicit_changeset` when `X-ChangeSet-Id` is absent instead of auto-creating. Not changed in Phase 11 (too disruptive).

---

## 4. ChangeSetStatus enum — FAILED missing

The `ChangeSetStatus` Prisma enum only has `DRAFT | APPLIED | REVERTED` (schema.prisma line 734–739). There is no `FAILED` value.

**Consequence for `applyDeltaSpec`:** When apply encounters an error, the code uses `DISCARDED` (= deletes the CS row) instead of setting status=FAILED. This matches the existing discard behavior.

**Gap noted in `delta-spec-apply.ts`:** A comment marks the `DISCARDED` fallback. Adding `FAILED` would require a Prisma migration (out of scope Phase 11).

---

## 5. Versioning extension coverage

`backend/src/versioning.ts` intercepts `create`, `update`, `delete` on all models in `VERSIONED_MODELS` (lines 44–91). Does NOT intercept `createMany`/`updateMany`/`deleteMany` or `upsert`. This is acceptable for V1 since `applyDeltaSpec` calls individual `create`/`update`/`delete` operations.

---

## 6. HTTP endpoints added (Phase 11)

All under `/api/projects/:id/changesets/`:

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/apply` | Apply a DeltaSpec within a ChangeSet |
| `POST` | `/:csid/revert` | Revert an APPLIED ChangeSet (already existed — confirmed present) |
| `GET` | `/spec-at` | Reconstruct spec state at a given version |
| `GET` | `/diff` | Diff two ChangeSets |

---

## 7. MCP tools added/confirmed (Phase 11)

| Tool | Status |
|---|---|
| `dtfs__begin_changeset` | CONFIRMED present |
| `dtfs__commit_changeset` | CONFIRMED present |
| `dtfs__discard_changeset` | CONFIRMED present |
| `dtfs__revert_changeset` | CONFIRMED present (mcp.ts line 249) |
| `dtfs__apply_delta_spec` | ADDED |
| `dtfs__get_spec_at` | ADDED |
| `dtfs__diff_changesets` | ADDED |

---

## 8. Known remaining gaps (V2)

1. `ChangeSetStatus.FAILED` enum value — requires migration.
2. Hard "explicit CS required" gate — disruptive, deferred.
3. `getSpecAt` V1 only reconstructs Entities + Attributes + Operations. All other buckets return `{}` placeholder.
4. `applyDeltaSpec` V1 supports: entities, attributes, relations, operations, policies, resources, screens. Remaining buckets log `not_implemented_yet`.
5. No single-transaction wrapping of `applyDeltaSpec` — intentional (too large for Postgres tx). Partial failures leave partial state; the ChangeSet is marked DISCARDED on error.
