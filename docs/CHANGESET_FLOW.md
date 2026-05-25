# ChangeSet Flow

Every write to the Control Plane is grouped under a **ChangeSet**. This document
describes the mandatory flow, the gate, all functions, and provides curl examples
for the full cycle.

---

## Mandatory gate

> **No open ChangeSet = no write.**

Every mutation route under `/:id/*` is wrapped by `changeset-middleware.ts`.
If the caller sends an `X-ChangeSet-Id` header, the middleware binds that
ChangeSet to the request via `AsyncLocalStorage` (`changeset-context.ts`).
If no header is sent, the middleware opens an **implicit** one-revision ChangeSet
automatically — this keeps V1 writes always attributed.

The `applyDeltaSpec` function calls `runInChangeSet` internally, so every row it
creates or updates is linked to the given ChangeSet.

---

## Lifecycle states

```
DRAFT → APPLIED
DRAFT → (deleted = discarded)
APPLIED → REVERTED
```

---

## Flux obligatoire

```
begin_changeset
  → validate_spec      (optional static lint, no DB write)
  → apply_spec         (writes rows, emits Revisions)
  → commit_changeset
or:
  → discard_changeset  (delete DRAFT + its Revisions)
```

One-shot shortcut (opens, applies, and commits in one call):

```
POST /api/projects/:id/delta-spec/apply
```

---

## Function reference

| Function | Location | Description |
|---|---|---|
| `beginChangeSet` | MCP `dtfs__begin_changeset` / `POST /changesets/` | Open a DRAFT ChangeSet |
| `validateDeltaSpec` | `lib/delta-spec-validation.ts` | Static lint, no DB write |
| `applyDeltaSpec` | `lib/delta-spec-apply.ts` | Apply all buckets in dependency order, emit Revisions |
| `commitChangeSet` | MCP `dtfs__commit_changeset` / `POST /changesets/:csId/commit` | Mark DRAFT as APPLIED |
| `discardChangeSet` | MCP `dtfs__discard_changeset` / `DELETE /changesets/:csId` | Delete DRAFT + Revisions |
| `revertChangeSet` | `lib/revert.ts` / `POST /changesets/:csId/revert` | Create inverse APPLIED CS |
| `revertRevision` | `lib/revert.ts#revertOne` / `POST /revisions/:rid/revert` | Revert one Revision |
| `revertField` | `lib/revert.ts#revertField` / `POST /revisions/:rid/revert-field` | Revert one field |
| `getSpecAt` | `lib/spec-snapshot.ts` / `GET /changesets/:csId/spec-at` | Snapshot at a ChangeSet |
| `diffChangeSets` | `lib/changeset-diff.ts` / `GET /changesets/diff?from=&to=` | Diff two ChangeSets |

---

## HTTP endpoints

All routes are under `/api/projects/:projectId/`.

| Method | Path | Body / Query | Description |
|---|---|---|---|
| POST | `changesets/` | `{ message }` | Open DRAFT |
| POST | `changesets/:csId/commit` | — | Commit DRAFT → APPLIED |
| DELETE | `changesets/:csId` | — | Discard DRAFT |
| POST | `changesets/:csId/revert` | — | Revert APPLIED |
| GET | `changesets/` | `?limit&before` | List ChangeSets |
| GET | `changesets/:csId` | — | Detail + Revisions |
| GET | `changesets/:csId/spec-at` | — | Spec snapshot at CS |
| GET | `changesets/diff` | `?from=&to=` | Diff two ChangeSets |
| GET | `changesets/spec-at` | `?version=<n>\|latest` | Snapshot at version |
| POST | `delta-spec/apply` | `{ deltaSpec, message }` | One-shot open+apply+commit |
| POST | `delta-spec/validate` | `{ deltaSpec }` | Static lint |
| POST | `delta-spec/explain` | `{ deltaSpec }` | Human-readable summary |

---

## Curl examples — complete cycle

Substitute `BASE=http://localhost:4002` and `PID=<your-project-id>`.

### 1. Compile a DeltaSpec from an accepted proposal

```bash
BASE=http://localhost:4002
PID=cmpji9ev90001m5p05krcodcg
PROP_ID=cmpjm6cft0001cnp020uma15k

SPEC=$(curl -s -X POST $BASE/api/projects/$PID/delta-spec/from-proposal \
  -H "Content-Type: application/json" \
  -d "{\"proposalId\":\"$PROP_ID\"}" | jq -c .deltaSpec)
echo $SPEC | jq .
```

### 2. Static lint (optional)

```bash
curl -s -X POST $BASE/api/projects/$PID/delta-spec/validate \
  -H "Content-Type: application/json" \
  -d "{\"deltaSpec\":$SPEC}" | jq .
```

### 3. One-shot apply (opens CS + applies + commits)

```bash
APPLY=$(curl -s -X POST $BASE/api/projects/$PID/delta-spec/apply \
  -H "Content-Type: application/json" \
  -d "{\"deltaSpec\":$SPEC,\"message\":\"phase11 smoke\"}")
echo $APPLY | jq .
CSID=$(echo $APPLY | jq -r .changeSetId)
```

### 4. Manual cycle: begin → apply → commit

```bash
# 4a. Begin DRAFT
CS=$(curl -s -X POST $BASE/api/projects/$PID/changesets/ \
  -H "Content-Type: application/json" \
  -d '{"message":"manual cycle"}')
CSID=$(echo $CS | jq -r .changeSet.id)

# 4b. Apply inside that CS
curl -s -X POST $BASE/api/projects/$PID/changesets/apply \
  -H "Content-Type: application/json" \
  -d "{\"changeSetId\":\"$CSID\",\"deltaSpec\":$SPEC}" | jq .

# 4c. Commit
curl -s -X POST $BASE/api/projects/$PID/changesets/$CSID/commit | jq .
```

### 5. Snapshot at a specific ChangeSet

```bash
curl -s $BASE/api/projects/$PID/changesets/$CSID/spec-at | jq .spec.entities[].name
```

### 6. Diff two ChangeSets

```bash
curl -s "$BASE/api/projects/$PID/changesets/diff?from=$CSID_A&to=$CSID_B" | jq .
```

### 7. Revert

```bash
curl -s -X POST $BASE/api/projects/$PID/changesets/$CSID/revert | jq .
```

---

## applyDeltaSpec — bucket dependency order

Buckets are applied in this order so foreign-key refs always resolve:

1. ProductSpecs
2. ScreenSpecs
3. Requirements
4. Entities
5. Attributes *(resolves entityName → entity.id)*
6. Relations *(resolves fromEntityName + toEntityName)*
7. Policies *(optional entityName ref)*
8. Integrations
9. Operations
10. Resources *(resolves entityName)*
11. Triggers *(resolves operationName)*
12. Workflows / AuthMethods / Assets *(V2 — skipped, logged in result.skipped)*
13. Screens
14. Components / Forms / Fields / Actions / DataBindings / TestScenarios *(V2 — skipped)*
15. Deletes (reverse order of creates)

Name-refs (`entityName`, `operationName`) are resolved first from rows created in
this same DeltaSpec, then from the DB.

---

## Known V1 limits

- `getSpecAt` reconstructs Entity + Attribute + Operation only. Relations, Resources,
  Policies, Screens are empty in V1 snapshots.
- `diffChangeSets` compares by `entityType:entityId` key; a single entity touched
  by both ChangeSets appears in `commonChanged` (not a field-level merge).
- Workflows, AuthMethods, Assets, Components, Forms, Fields, Actions, DataBindings,
  TestScenarios are V2 — `applyDeltaSpec` logs them in `result.skipped`.
