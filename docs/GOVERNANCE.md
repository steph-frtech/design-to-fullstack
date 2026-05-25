# GOVERNANCE

Centralised guardrails and audit trail for the design-to-fullstack platform.

## Overview

Governance prevents the platform from drifting into inconsistent, insecure, or
destructive states. Every apply and codegen path runs through a set of
deterministic, synchronous checks before any mutation is attempted.

The implementation lives in `backend/src/lib/governance/`:

```
guardrails.ts       — 7 individual guard functions
audit.ts            — AuditEvent emitter (JSONL + optional DB)
governance-check.ts — aggregator: runGovernanceChecks()
governance.test.ts  — node:test suite (no DB required)
```

---

## The 7 Guardrails

### 1. `guardChangeSetRequired(ctx)`

**What**: Refuses any write that is not running inside a ChangeSet context.

**Where wired**: The `changeSetMiddleware` (auto-wraps every `POST/PUT/PATCH/DELETE`
under `/:id/*`) already enforces this at the HTTP layer. `guardChangeSetRequired` is
available for explicit checking when bypassing the middleware (e.g., in MCP tools or
service-layer code).

**Returns**: `{ ok: false, code: "changeset_required" }` when `ctx.changeSetId` is
absent or null.

---

### 2. `guardNoInlineSecrets(deltaSpec)`

**What**: Heuristic scan for inline secret values. Detects:
- Field names matching `/password|secret|apiKey|token|.../i` with a literal string
  value that does not start with `secretRef:`, `env:`, `vault:`, or `$ref:`.
- Values matching known secret prefixes: `sk_live_`, `sk_test_`, `figd_`, `AKIA...`,
  `ghp_`, `glpat-`, `xoxb-`, `xoxp-`.
- Values >= 40 characters of base64/hex with no whitespace in non-benign fields.

**Where wired**: `POST /:id/apply` and `POST /:id/delta-spec/apply` run this before
any CS is created.

**Correct usage** — pass secret references, not literals:
```json
{ "config": { "apiKey": "secretRef:env:STRIPE_KEY" } }
```

**Returns**: `{ ok: false, code: "inline_secrets_detected", details: [{path, reason}] }`

---

### 3. `guardDeleteRequiresValidation(deltaSpec, opts)`

**What**: Any DeltaSpec bucket whose `.delete` array is non-empty requires
`opts.confirmDeletes === true` to be explicitly set by the caller.

**Where wired**: `POST /:id/apply` and `POST /:id/delta-spec/apply`. Pass
`"confirmDeletes": true` in the request body to proceed.

**Returns**: `{ ok: false, code: "delete_requires_validation", details: { bucketsWithDeletes: [...] } }`

---

### 4. `guardNoUnknownExprFunctions(deltaSpec)`

**What**: Walks all Expr nodes embedded in the DeltaSpec (operations.steps, policy
rules, etc.) and verifies every `{ call: "..." }` node is in `EXPR_FUNCTIONS`.

**Where wired**: `POST /:id/apply` and `POST /:id/delta-spec/apply`.

The allowed function set (see `src/lib/dsl/expr-ast.ts`):
`lowercase`, `uppercase`, `trim`, `concat`, `length`, `now`, `uuid`, `randomToken`.

**Returns**: `{ ok: false, code: "unknown_expr_functions", details: { unknownCalls: [...] } }`

---

### 5. `guardValidateBeforeApply(deltaSpec, ctx)`

**What**: Runs the full `validateDeltaSpec` check (Zod structural + cross-ref
checks: entity names, operation names, attribute refs, relation refs). Blocks the
apply if any error is found.

**Where wired**: `POST /:id/apply` and `POST /:id/delta-spec/apply`. The ctx is
loaded from DB (existing entity/operation names) before calling.

**Returns**: `{ ok: false, code: "validate_before_apply", details: errors[] }`

---

### 6. `guardCodegenNeedsArtifactTracking(opts)`

**What**: A non-dryRun codegen must explicitly set `opts.trackArtifacts = true`.
This ensures the caller intends to record GeneratedArtifact rows. `dryRun` codegen
is always allowed without tracking.

**Where wired**: `POST /:id/codegen` when `dryRun !== true`.

**Returns**: `{ ok: false, code: "codegen_needs_artifact_tracking" }`

---

### 7. `guardNoCriticalOpenQuestions(projectId)`

**What**: Delegates to `checkClarificationGate`. Blocks generation if any
`OpenQuestion` or `Assumption` with `status = "OPEN"` exists for the project.

**Where wired**: `POST /:id/codegen` (non-dryRun path) via `runGovernanceChecks`
with `checkClarificationGate: true`.

**Returns**: `{ ok: false, code: "critical_open_questions", details: { openQuestions, openAssumptions } }`

---

## Governance Report

`runGovernanceChecks(projectId, deltaSpec, opts)` runs all relevant guards and
returns:

```ts
type GovernanceReport = {
  ok: boolean;                    // false if any violation has severity "block"
  violations: GovernanceViolation[];
  passed: string[];               // codes of guards that passed
}

type GovernanceViolation = {
  code: string;
  message: string;
  severity: "block" | "warn";
  details?: unknown;
}
```

When `ok === false`, the HTTP endpoints return `422` with:
```json
{ "error": "governance_violation", "violations": [...] }
```

---

## AuditLog

### V1: JSONL file (always enabled)

Every audit event is appended as a JSON line to a file:

- **Default path**: `/tmp/dtfs-audit.jsonl`
- **Override**: set `DTFS_AUDIT_LOG=/path/to/audit.log.jsonl`

The file is **never** inside the tracked git repository. Do not change the
default to a path inside the repo.

Event format:
```json
{
  "id": "al_lx8abc_def123",
  "projectId": "proj_...",
  "actor": null,
  "action": "apply_delta",
  "target": { "changeSetId": "cs_...", "message": "..." },
  "metadata": { "appliedCount": 3 },
  "createdAt": "2026-05-24T09:00:00.000Z"
}
```

### V2: DB persist (gated on Phase 10 migration)

Set `DTFS_AUDIT_DB=1` to also persist events to `prisma.auditLog`.

**This flag must only be set when the Phase 10 migration
(`20260524110000_phase_10_enriched_models`) has been applied to the database.**
That migration adds the `action`, `entityType`, `entityId`, and `details` columns
to the `AuditLog` table. Without it, the DB write will fail.

The JSONL file write always happens regardless of `DTFS_AUDIT_DB`. The DB persist
is an additional best-effort path — errors are logged to stderr, not re-thrown.

### Audited actions

| Action | Trigger |
|---|---|
| `apply_delta` | `POST /:id/apply` or `POST /:id/delta-spec/apply` |
| `commit_changeset` | `POST /:id/changesets/:csid/commit` |
| `revert_changeset` | `POST /:id/changesets/:csid/revert` |
| `generate_app` | `POST /:id/codegen` (non-dryRun only) |

---

## MCP Tools

### `dtfs__run_governance_checks`

Run all governance guardrails before applying a DeltaSpec.

```
Input:  { projectId, deltaSpec, confirmDeletes? }
Output: { ok, violations, passed }
```

### `dtfs__read_audit_log`

Read events from the JSONL audit log. Returns latest-first.

```
Input:  { projectId?, action?, limit? }
Output: { events, count }
```

---

## Testing

```bash
node --import tsx/esm --test backend/src/lib/governance/governance.test.ts
```

Tests cover:
- `guardNoInlineSecrets`: `sk_live_xxx` → violation; `secretRef:env:X` → OK.
- `guardNoUnknownExprFunctions`: `{call:"hackzor"}` → violation; `lowercase` → OK.
- `guardDeleteRequiresValidation`: delete without confirmDeletes → violation; with → OK.
- `guardValidateBeforeApply`: invalid deltaSpec → block.
- `emitAuditEvent` / `readAuditLog`: write + read round-trip using `/tmp` path.
- Aggregation logic via individual guard results.
