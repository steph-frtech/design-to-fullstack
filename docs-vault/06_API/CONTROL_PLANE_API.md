# CONTROL_PLANE_API

The Control Plane HTTP API is the REST surface of the DTFS backend (`:4002`).
It manages projects, specs, changesets, delta operations, concept CRUD, contracts, and codegen.
All routes are real and documented in `docs/HTTP_API.md`; this page organises them by family.

[[OPENAPI_GUIDELINES]] · [[GENERATED_CLIENT_API]] · [[03_Control_Plane/]] · [[openapi/control-plane.openapi.yaml]]

## Source of truth

`docs/HTTP_API.md` — the canonical endpoint reference, manually verified against `backend/src/app.ts`, `backend/src/projects.ts`, `backend/src/versioning.ts`, `backend/src/changesets.ts`.

## AI usage

Use MCP tools (`dtfs__*`) to interact with the Control Plane programmatically. These HTTP routes exist for the dashboard UI and direct integration; prefer MCP tools for agent workflows.

## Status

Live — routes exist at `:4002`. Routes marked `501-delegated` exist but require an LLM/agent to produce the body.

---

## Route families

### /api/projects

Core project lifecycle.

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/projects` | List all projects |
| GET | `/api/projects/:id` | Get project by id |
| POST | `/api/projects` | Create project (`slug`, `localeCode?`, `localeName?`, `extraLocales?`, `localPath?`, `github?`, `screenTypes?`) |

### /api/projects/:id/spec

Spec snapshots in JSON and Markdown.

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/projects/:id/spec` | Full spec JSON |
| GET | `/api/projects/:id/spec.json` | Alias |
| GET | `/api/projects/:id/spec.md` | Markdown rendering |
| GET | `/api/projects/:id/revision-at?version=n\|latest` | Spec at a given version |

### /api/projects/:id/changesets

ChangeSet lifecycle (draft → committed → reverted).

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/projects/:id/changesets` | List changesets (`?limit=&before=`) |
| POST | `/api/projects/:id/changesets` | Create draft changeset (`{ message }`) |
| GET | `/api/projects/:id/changesets/:csid` | Get changeset with revisions |
| POST | `/api/projects/:id/changesets/:csid/commit` | Commit draft |
| DELETE | `/api/projects/:id/changesets/:csid` | Discard draft |
| POST | `/api/projects/:id/changesets/:csid/revert` | Revert committed changeset |
| POST | `/api/projects/:id/changesets/apply` | Apply a delta spec inside a changeset |
| GET | `/api/projects/:id/changesets/diff?from=&to=` | Diff two changesets |
| GET | `/api/projects/:id/changesets/:csid/spec-at` | Spec snapshot at that changeset |

Top-level aliases (no projectId needed): `/api/changesets/:id`, `/api/changesets/:id/commit`, `/api/changesets/:id/discard`, `/api/changesets/:id/revert`.

### /api/projects/:id/delta-spec

DeltaSpec operations — the write path for all Control Plane mutations.

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/projects/:id/delta-spec/from-proposal` | Compile DeltaSpec from a PlatformProposal |
| POST | `/api/projects/:id/delta-spec/validate` | Validate a DeltaSpec (`{ ok, errors }`) |
| POST | `/api/projects/:id/delta-spec/apply` | Apply DeltaSpec (`{ deltaSpec, message? }`) |
| POST | `/api/projects/:id/delta-spec/explain` | Human-readable explanation |

Canonical aliases: `/api/projects/:id/delta/from-proposal`, `/api/projects/:id/validate`, `/api/projects/:id/apply`.

### /api/projects/:id — Concept CRUD

All concept families follow the same REST pattern: `GET /`, `GET /:cid`, `POST /`, `PUT /:cid`, `DELETE /:cid`.

| Concept | Mount path |
|---------|-----------|
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

### /api/projects/:id — Runtime contracts and codegen (Phase 26+)

| Method | Path | Notes |
|--------|------|-------|
| GET/PUT | `/api/projects/:id/runtime-target` | Get or set RuntimeTarget |
| POST | `/api/projects/:id/contracts/backend` | Compile BackendContract |
| POST | `/api/projects/:id/contracts/frontend` | Compile FrontendContract |
| POST | `/api/projects/:id/contracts/shared` | Compile SharedContract |
| GET | `/api/projects/:id/contracts/validate` | Validate all contracts |
| POST | `/api/projects/:id/codegen` | Trigger full codegen |

### /api/projects/:id — Gates, translations, locales

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/projects/:id/coverage-gate` | Coverage gate check |
| GET | `/api/projects/:id/clarification-gate` | Clarification gate check |
| GET/PUT | `/api/projects/:id/translations` | Read / upsert translations |
| POST | `/api/projects/:id/locales` | Add locale |
| DELETE | `/api/projects/:id/locales/:localeId` | Remove locale |

### /api — System and catalogue

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/revisions?entityType=&entityId=` | List revisions |
| POST | `/api/revisions/:rid/revert` | Revert a revision |
| POST | `/api/revisions/:rid/revert-field` | Revert one field |
| POST | `/api/system/prepare-identity` | Scaffold local path + GitHub repo |
| GET | `/api/behaviors` | Behavior catalogue |

### 501-delegated routes

These routes exist and respond HTTP 501. An LLM agent or MCP tool must produce the body.

| Method | Path | Delegate |
|--------|------|---------|
| POST | `/api/projects/:id/product-spec/from-prompt` | `dtfs-product-analyst` |
| POST | `/api/projects/:id/screen-spec/from-prompt` | `dtfs-screen-spec-writer` |
| POST | `/api/projects/:id/sdd/generate` | `dtfs-sdd-writer` |
| POST | `/api/projects/:id/platform/propose` | `dtfs-platform-mapper` |

---

See `openapi/control-plane.openapi.yaml` for the machine-readable version.
