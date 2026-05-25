# HTTP API — Canonical Endpoint Reference

All endpoints are prefixed with the base URL (e.g. `http://localhost:4002`).
Authentication is not enforced on most routes in development — the demo user is
auto-provisioned.

## Status legend

| Symbol | Meaning |
| ------ | ------- |
| live | Route exists at the exact canonical path |
| alias-added | Canonical path added; original path still works |
| 501-delegated | Route exists and responds; LLM-dependent logic delegates to MCP/agent |

---

## Projects

| Method | Path | Status | Body | Response |
| ------ | ---- | ------ | ---- | -------- |
| GET | `/api/projects` | live | — | `{ projects: Project[] }` |
| GET | `/api/projects/:id` | live | — | `{ project: Project }` |
| POST | `/api/projects` | live | `{ slug, localeCode?, localeName?, extraLocales?, localPath?, github?, screenTypes? }` | `{ project }` 201 |

---

## Spec snapshots

| Method | Path | Status | Body | Response |
| ------ | ---- | ------ | ---- | -------- |
| GET | `/api/projects/:id/spec.json` | alias-added | — | `{ spec }` 200 — same as `/spec` |
| GET | `/api/projects/:id/spec.md` | alias-added | — | `text/markdown` — Markdown rendering of the spec |
| GET | `/api/projects/:id/spec` | live (original) | — | `{ spec }` |
| GET | `/api/projects/:id/spec/.md` | live (original) | — | `text/markdown` |

---

## Spec-at / Revision history

| Method | Path | Status | Body / Query | Response |
| ------ | ---- | ------ | ------------ | -------- |
| GET | `/api/projects/:id/revision-at` | alias-added | `?version=<n>\|latest` | `{ spec }` — project state at given version |
| GET | `/api/projects/:id/changesets/spec-at` | live (original) | `?version=<n>\|latest` | `{ spec }` |
| GET | `/api/projects/:id/changesets/:csid/spec-at` | live | — | `{ changeSetId, atVersion, spec }` |

---

## Diff

| Method | Path | Status | Query | Response |
| ------ | ---- | ------ | ----- | -------- |
| GET | `/api/projects/:id/diff` | alias-added | `?from=<csId>&to=<csId>` or `?a=<csId>&b=<csId>` | diff result |
| GET | `/api/projects/:id/changesets/diff` | live (original) | same | same |

---

## ChangeSets — project-scoped

| Method | Path | Status | Body | Response |
| ------ | ---- | ------ | ---- | -------- |
| GET | `/api/projects/:id/changesets` | live | `?limit=&before=` | `{ items: ChangeSet[] }` |
| POST | `/api/projects/:id/changesets` | live | `{ message }` | `{ changeSet }` 201 |
| GET | `/api/projects/:id/changesets/:csid` | live | — | `{ changeSet }` with revisions |
| POST | `/api/projects/:id/changesets/:csid/commit` | live | — | `{ changeSet }` |
| DELETE | `/api/projects/:id/changesets/:csid` | live | — | `{ ok }` — discard DRAFT |
| POST | `/api/projects/:id/changesets/:csid/revert` | live | — | `{ changeSet, entries }` |
| POST | `/api/projects/:id/changesets/apply` | live | `{ changeSetId, deltaSpec, dryRun? }` | apply result |

---

## ChangeSets — top-level (no projectId in URL)

Useful when only the ChangeSet ID is known. The projectId is resolved from the
row itself.

| Method | Path | Status | Body | Response |
| ------ | ---- | ------ | ---- | -------- |
| GET | `/api/changesets/:id` | alias-added | — | `{ changeSet }` with revisions |
| POST | `/api/changesets/:id/commit` | alias-added | — | `{ changeSet }` |
| POST | `/api/changesets/:id/discard` | alias-added | — | `{ ok }` — discard DRAFT |
| POST | `/api/changesets/:id/revert` | alias-added | — | `{ changeSet, entries }` |

---

## DeltaSpec operations

| Method | Path | Status | Body | Response |
| ------ | ---- | ------ | ---- | -------- |
| POST | `/api/projects/:id/delta/from-proposal` | alias-added | `{ proposalId }` | `{ deltaSpec }` |
| POST | `/api/projects/:id/delta-spec/from-proposal` | live (original) | `{ proposalId }` | `{ deltaSpec }` |
| POST | `/api/projects/:id/validate` | alias-added | `{ deltaSpec }` | `{ ok, errors }` |
| POST | `/api/projects/:id/delta-spec/validate` | live (original) | `{ deltaSpec }` | `{ ok, errors }` |
| POST | `/api/projects/:id/apply` | alias-added | `{ deltaSpec, message? }` | `{ ok, changeSetId, applied, createdIds, skipped }` |
| POST | `/api/projects/:id/delta-spec/apply` | live (original) | `{ deltaSpec, message? }` | same |
| POST | `/api/projects/:id/delta-spec/explain` | live | `{ deltaSpec }` | `{ markdown }` |

---

## LLM-delegated endpoints (501)

These routes exist and respond with HTTP 501. They require an LLM agent or MCP
tool to generate the structured payload, which is then forwarded to the
corresponding CRUD endpoint.

| Method | Path | Status | Delegate to |
| ------ | ---- | ------ | ----------- |
| POST | `/api/projects/:id/product-spec/from-prompt` | 501-delegated | agent `dtfs-product-analyst` → `POST /api/projects/:id/product-specs` |
| POST | `/api/projects/:id/screen-spec/from-prompt` | 501-delegated | agent `dtfs-screen-spec-writer` → `POST /api/projects/:id/screen-specs` |
| POST | `/api/projects/:id/sdd/generate` | 501-delegated | agent `dtfs-sdd-writer` → `POST /api/projects/:id/sdd-artifacts/generate` |
| POST | `/api/projects/:id/platform/propose` | 501-delegated | agent `dtfs-platform-mapper` → `POST /api/projects/:id/platform-proposals` |

Response body for all 501 routes:

```json
{
  "error": "not_implemented_without_llm",
  "hint": "<human-readable pointer to the MCP tool or agent>"
}
```

---

## Concept CRUD (project-scoped)

All concept routes follow the same REST pattern:
`GET /`, `GET /:cid`, `POST /`, `PUT /:cid`, `DELETE /:cid`.

| Concept | Mount path |
| ------- | ---------- |
| ProductSpec | `/api/projects/:id/product-specs` |
| ScreenSpec | `/api/projects/:id/screen-specs` |
| SddArtifact | `/api/projects/:id/sdd-artifacts` |
| PlatformProposal | `/api/projects/:id/platform-proposals` |
| Resource | `/api/projects/:id/resources` |
| Operation | `/api/projects/:id/operations` |
| Policy | `/api/projects/:id/policies` |
| Integration | `/api/projects/:id/integrations` |
| Trigger | `/api/projects/:id/triggers` |
| Behavior | `/api/projects/:id/behaviors` |
| EntityRelation | `/api/projects/:id/relations` |
| Requirement | `/api/projects/:id/requirements` |
| RequirementMapping | `/api/projects/:id/requirement-mappings` |
| OpenQuestion | `/api/projects/:id/open-questions` |
| Assumption | `/api/projects/:id/assumptions` |

---

## Additional project-level endpoints

| Method | Path | Notes |
| ------ | ---- | ----- |
| GET | `/api/projects/:id/coverage-gate` | Coverage gate check |
| GET | `/api/projects/:id/clarification-gate` | Clarification gate check |
| GET | `/api/projects/:id/translations` | `?locale=<code>` optional |
| PUT | `/api/projects/:id/translations` | Upsert a translation value |
| POST | `/api/projects/:id/locales` | Add a locale to the project |
| DELETE | `/api/projects/:id/locales/:localeId` | Remove a locale |
| GET | `/api/projects/:id/screens/:screenId` | Screen detail |
| POST | `/api/projects/:id/platform-proposals/synthesize` | Build proposal skeleton (no LLM) |
| POST | `/api/projects/:id/platform-proposals/:ppid/accept` | Accept a proposal |
| POST | `/api/projects/:id/platform-proposals/:ppid/reject` | Reject a proposal |
| POST | `/api/projects/:id/sdd-artifacts/generate` | Bulk upsert SDD artifacts from agent output |
| POST | `/api/projects/:id/sdd-artifacts/sync` | Sync artifacts to/from disk |
| POST | `/api/projects/:id/spec/validate` | Validate operation steps + policy rules |
| POST | `/api/projects/:id/spec/expand-behaviors` | Expand behavior catalogue entries |

---

## Revisions (ultra-fine revert)

| Method | Path | Notes |
| ------ | ---- | ----- |
| GET | `/api/revisions` | `?entityType=&entityId=` — list revisions for an entity |
| POST | `/api/revisions/:rid/revert` | Revert a single Revision |
| POST | `/api/revisions/:rid/revert-field` | `{ field }` — revert one field of a Revision |

---

## System

| Method | Path | Notes |
| ------ | ---- | ----- |
| POST | `/api/system/prepare-identity` | Scaffold local path + GitHub repo |

---

## Behaviors catalogue

| Method | Path | Notes |
| ------ | ---- | ----- |
| GET | `/api/behaviors` | List available behavior catalogue entries |
