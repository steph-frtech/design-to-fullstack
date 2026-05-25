# Testing Guide

## Philosophy

The test suite is divided into four layers with distinct goals:

**Deterministic unit tests** verify pure transforms — functions that take input and return output with no side effects. These run without a DB connection and should never flap. They cover: Expr DSL (validate/eval/analyze), Policy DSL (validate/eval), Operation DSL (validate/analyze), DeltaSpec (validate/compile/explain), Behavior expansion, HTML import, Codegen emitters and safe-path.

**Contract tests** verify structural guarantees of the pipeline outputs. They are deterministic (no LLM, no DB) and assert properties like: Zod-valid output, no unknown Expr functions, no orphan policies, QUERY operations have return steps. The `assertDeltaSpecContract` helper is the central contract checker, reusable by any agent or pipeline step.

**Golden tests** lock the structure of `compileProposalToDelta` outputs against known fixtures. They do not assert exact deep-equality (which would break on trivial schema changes) but instead check bucket presence, item counts, and item names. Every golden fixture also passes `assertDeltaSpecContract`.

**E2E integration tests** run against the real PostgreSQL database. They are intentionally narrow: create ephemeral project, apply DeltaSpec, verify DB rows, commit, revert, verify rollback, codegen dryRun. Anti-pollution is enforced via try/finally teardown.

## How to Run

```bash
# All tests (unit + golden + contract + e2e) — requires ../.env with DATABASE_URL
cd backend
pnpm test

# Unit + golden + contract only (no DB required)
pnpm test:unit

# E2E only (DB required)
pnpm test:e2e
```

The exact command executed by `pnpm test`:
```bash
node --import tsx/esm --env-file=../.env --test $(find src -name '*.test.ts' | sort | tr '\n' ' ')
```

For `pnpm test:unit` (no DB):
```bash
node --import tsx/esm --test $(find src -name '*.test.ts' ! -path '*/e2e/*' | sort | tr '\n' ' ')
```

Note: `codegen.test.ts` imports `db.ts` transitively so it requires `--env-file=../.env` for the full suite, but only the E2E tests actually connect to the database.

## Test File Locations

```
backend/src/
  lib/
    dsl/
      expr.test.ts                   # Expr validate + eval + analyze
      operation-dsl.test.ts          # Operation + Policy DSL (validate + eval)
    delta-spec.test.ts               # DeltaSpec validate + compile + explain
    behavior-expand.test.ts          # Behavior expansion
    changeset-flow.test.ts           # apply_spec + revert + spec-snapshot (mock DB)
    import/
      html-import.test.ts            # HTML/Figma import pipeline
    contract/
      assertions.test.ts             # assertDeltaSpecContract contract helper
  codegen/
    codegen.test.ts                  # Codegen emitters + safe-path
  test/
    golden/
      fixtures.ts                    # Fixture data (not a test file)
      pipeline.golden.test.ts        # Golden + contract tests for compile pipeline
    e2e/
      pipeline.e2e.test.ts           # Full E2E: apply → commit → revert (real DB)
```

## Anti-pollution Rules

E2E tests that write to the database MUST:

1. Create an ephemeral project with slug `__test_eph_<timestamp>`.
2. Wrap all test logic in a `try/finally` that deletes the project (cascade deletes all children).
3. Never reference the test principal project `cmpji9ev90001m5p05krcodcg`.
4. Assert at teardown that 0 `__test_eph_*` projects remain.

The `after()` hook in `pipeline.e2e.test.ts` enforces this. If the test crashes mid-way, the `try/finally` in `after()` still runs and cleans up.

## Plan Checklist Coverage

From `plan.md` lines 456–502:

| Item | Type | File | Status |
|------|------|------|--------|
| Expr validation | deterministic | `dsl/expr.test.ts` | PASS |
| Expr eval | deterministic | `dsl/expr.test.ts` | PASS |
| Policy eval | deterministic | `dsl/operation-dsl.test.ts` | PASS |
| Operation validation | deterministic | `dsl/operation-dsl.test.ts` | PASS |
| DeltaSpec validation | deterministic | `delta-spec.test.ts` | PASS |
| apply_spec | det. (mock) + e2e | `changeset-flow.test.ts` + e2e | PASS |
| revert_changeset | det. (mock) + e2e | `changeset-flow.test.ts` + e2e | PASS |
| Behavior expansion | deterministic | `behavior-expand.test.ts` | PASS |
| Codegen output | deterministic | `codegen/codegen.test.ts` | PASS |
| Prompt→ProductSpec contract | golden/contract | `golden/pipeline.golden.test.ts` | PASS (compile fixture) |
| specs→Requirements→PlatformSpec→DeltaSpec | golden | `golden/pipeline.golden.test.ts` | PASS (fixture coverage) |
| assertCoverageContract | contract | `contract/assertions.ts` | available (V2 integration) |
| E2E pipeline | e2e | `e2e/pipeline.e2e.test.ts` | PASS |

## Known Gaps (V2)

- `assertCoverageContract` (requires DB) is not wired into the CI test suite; use it directly in agents.
- Workflow, AuthMethod, Asset, Forms, Fields, Actions, DataBindings apply buckets are `not_implemented_yet` — no E2E coverage.
- Figma live API smoke test requires a `FIGMA_TOKEN` env var; stubbed in unit tests.
