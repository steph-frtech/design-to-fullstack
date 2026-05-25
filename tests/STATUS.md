# Test Suite Status

Last run: 2026-05-25
Total: **330 pass / 0 fail**

## Test Suites

| File | Type | Tests | Status | Plan items covered |
|------|------|-------|--------|-------------------|
| `backend/src/lib/dsl/expr.test.ts` | deterministic | 36 | PASS | Expr validation, Expr eval |
| `backend/src/lib/dsl/operation-dsl.test.ts` | deterministic | 70 | PASS | Operation validation, Policy eval (embedded) |
| `backend/src/lib/behavior-expand.test.ts` | deterministic | 21 | PASS | Behavior expansion |
| `backend/src/lib/changeset-flow.test.ts` | deterministic (mock DB) | 6 | PASS | apply_spec (mocked), revert_changeset (mocked) |
| `backend/src/lib/import/html-import.test.ts` | deterministic | 8 | PASS | HTML import pipeline |
| `backend/src/codegen/codegen.test.ts` | deterministic | 28 | PASS | Codegen output, safe-path |
| `backend/src/codegen/codegen-contracts.test.ts` | deterministic + DB | 57 | PASS | Phase 28: emitShared, emitAuth, emitHono, emitNext, emitSdk, emitTests, diffArtifacts, planCodegen, generateBackendApi dryRun, generateApp dryRun, anti-pollution |
| `backend/src/lib/delta-spec.test.ts` | deterministic | 23 | PASS | DeltaSpec validation, compileProposalToDelta, explainDeltaSpec |
| `backend/src/lib/contract/assertions.test.ts` | contract | 13 | PASS | assertDeltaSpecContract (Zod, unknown_expr_function, orphan_policy, missing_return) |
| `backend/src/lib/contracts/contracts.test.ts` | integration (DB) | 11 | PASS | compileBackendContract, compileFrontendContract, compileSharedContract, validateContracts, getRuntimeTarget, setRuntimeTarget |
| `backend/src/test/golden/pipeline.golden.test.ts` | golden/contract | 19 | PASS | compileProposalToDelta → golden contracts, assertDeltaSpecContract on fixtures |
| `backend/src/test/e2e/pipeline.e2e.test.ts` | e2e (real DB) | 9 | PASS | apply_spec (real), revert_changeset (real), codegen dryRun, anti-pollution |
| `backend/src/test/e2e/contracts-codegen.e2e.test.ts` | e2e addendum (real DB) | 10 | PASS | Phase 29: BackendContract, FrontendContract, SharedContract, generateApp dryRun manifest, generateApp to disk + manifest, checkGeneratedProject protected flag, anti-pollution |

## Plan Checklist Coverage (Phase 29 — 17 items)

| Plan item | Covered by | Status |
|-----------|-----------|--------|
| Expr validation | expr.test.ts | PASS |
| Expr eval | expr.test.ts | PASS |
| Policy eval | operation-dsl.test.ts (`evalPolicyRule`) | PASS |
| Operation validation | operation-dsl.test.ts | PASS |
| DeltaSpec validation | delta-spec.test.ts | PASS |
| apply_spec | changeset-flow.test.ts (mock) + pipeline.e2e.test.ts (real) | PASS |
| revert_changeset | changeset-flow.test.ts (mock) + pipeline.e2e.test.ts (real) | PASS |
| Behavior expansion | behavior-expand.test.ts | PASS |
| Codegen output | codegen.test.ts | PASS |
| ProjectSpec → BackendContract OK | contracts.test.ts + contracts-codegen.e2e.test.ts | PASS |
| ProjectSpec → FrontendContract OK | contracts.test.ts + contracts-codegen.e2e.test.ts | PASS |
| ProjectSpec → SharedContract OK | contracts.test.ts + contracts-codegen.e2e.test.ts | PASS |
| Contracts → Hono API OK | codegen-contracts.test.ts + contracts-codegen.e2e.test.ts | PASS |
| Contracts → Next frontend OK | codegen-contracts.test.ts + contracts-codegen.e2e.test.ts | PASS |
| Contracts → SDK typed OK | codegen-contracts.test.ts (emitSdk) + contracts-codegen.e2e.test.ts | PASS |
| GeneratedArtifacts bien créés | contracts-codegen.e2e.test.ts (dryRun=false → manifest) | PASS |
| Aucun fichier manuel écrasé | contracts-codegen.e2e.test.ts (checkGeneratedProject protected flag) | PASS |

## Contract Assertions

| Contract | Implemented | Status |
|----------|------------|--------|
| JSON/Zod valid | assertDeltaSpecContract | PASS |
| No unknown Expr function | assertDeltaSpecContract | PASS |
| No entity cross-ref errors | assertDeltaSpecContract | PASS |
| No orphan policy | assertDeltaSpecContract | PASS |
| No QUERY without return | assertDeltaSpecContract | PASS |
| No uncovered CRITICAL requirement | assertCoverageContract (DB) | available, not in unit suite |

## Golden Tests

| Fixture | Structure asserted | Contract passes |
|---------|--------------------|----------------|
| todoProposal | entities(2), attrs(3), rels(1), resources(2), ops(1), policies(1) | YES |
| minimalProposal | entities(1), attrs(2), no extra buckets | YES |

## Anti-pollution

- E2E test creates project `__test_eph_<ts>` and deletes it in `after()` try/finally.
- Verified: 0 residual `__test_eph_*` projects after full suite.
- Test principal project `cmpji9ev90001m5p05krcodcg` is never touched.

## Pending Migrations (Human Gate)

Two migrations exist on disk but have NOT been applied to the DB — they require human review before running:

| Migration | Description | Gate |
|-----------|-------------|------|
| `20260524110000_phase_10_enriched_models` | Adds columns to Action, DataBinding, AppRole, EventDefinition, Screen | Review breaking changes |
| `20260524120000_control_plane_v1_3_runtime_contracts` | Creates `RuntimeTarget` and `CompileContract` tables (phases 25–26) | Review scope |

These are schema-only additions; the codebase already supports them conditionally. Apply only after human sign-off.

## V2 / Known Gaps

- `assertCoverageContract` (DB-dependent) is not in the unit test suite — available in `assertions.ts` for integration use.
- `policy-eval.test.ts` standalone file: policy eval is covered inside `operation-dsl.test.ts`. A dedicated file is redundant and skipped.
- Workflow, AuthMethod, Asset, Components, Forms, Fields, Actions, DataBindings apply buckets are `not_implemented_yet` in apply_spec — not tested end-to-end (V2).
- HTML import smoke test against live Figma API is V2.
