# AI Index

Entry point for AI agents (Claude Code, sub-agents, slash commands) working on the DTFS platform. Read this before touching any code.

---

## (a) Where to start

Read in this order — do not skip:

1. [[AI_PROJECT_BRIEF]] — one-page summary of DTFS: what it is, what it generates, key constraints.
2. [[ARCHITECTURE_OVERVIEW]] — understand the two-plane model before anything else.
3. [[AI_RULES]] — hard rules that apply to every task.
4. [[EXECUTION_FLOW]] — understand the 10-layer pipeline end to end.
5. [[GLOSSARY]] — know the canonical terms (Control Plane ≠ Client App DB).
6. [[AI_DO_NOT_BREAK]] — items that must never regress (P0 guardrails).

---

## (b) What to read before modifying

| Task | Read first | Source of truth file |
|---|---|---|
| Prisma schema | [[CONTROL_PLANE_MODEL]] | `backend/prisma/schema.prisma` |
| DeltaSpec / apply | [[DELTA_SPEC]] | `backend/src/lib/dsl/delta-spec.ts` |
| Expr / Operation / Policy DSL | [[EXPR_DSL]], [[OPERATION_DSL]], [[POLICY_DSL]] | `backend/src/lib/dsl/expr-ast.ts` |
| Contract compilation | [[CONTRACT_COMPILATION]], [[BACKEND_CONTRACT]], [[FRONTEND_CONTRACT]], [[SHARED_CONTRACT]] | `backend/src/lib/contracts/compile-*.ts` |
| Codegen / emitters | [[GENERATED_APP_OVERVIEW]], [[HONO_API_GENERATION]], [[NEXT16_GENERATION]] | `backend/src/codegen/codegen.ts` |
| ChangeSet / Revision | [[CHANGESET_REVISION]] | `backend/src/changesets.ts`, `backend/src/lib/revert.ts` |
| MCP tools | [[MCP_TOOLS]] | `backend/src/mcp.ts` |
| Agent definitions | [[AGENT_RESPONSIBILITIES]] | `.claude/agents/dtfs-*.md` |
| Guardrails | [[AI_DO_NOT_BREAK]], [[SAFETY_RULES]] | `backend/src/lib/guardrails.ts` |
| Testing | [[TEST_STRATEGY]] | `backend/src/**/*.test.ts` |
| SpecKit artifacts | [[SPEC_KIT_INTEGRATION]] | `backend/src/lib/spec-kit-sync.ts` |
| Docker / runtime | [[CLIENT_APP_DOCKER_RUNTIME]], [[RUNTIME_INSTANCES]] | `docs/RUNTIME_ROADMAP.md` |
| Audit findings | `docs/AUDIT_REPORT.md` | (read-only audit, 2026-05-25) |

---

## (c) Rules never to break

These are hard constraints. Violating them creates silent corruption or false-confidence bugs.

1. **Never go prompt → code directly.** All changes pass through the 10-layer pipeline: NL → ProductSpec → ScreenSpec → Requirements → PlatformSpecProposal → DeltaSpec → validate → apply → compile contracts → codegen.
2. **Never apply a DeltaSpec without calling `validateDeltaSpec` first.** This is a P0 guardrail. Currently not enforced in the code path — do not make it worse. See [[AI_DO_NOT_BREAK]].
3. **Never generate code without valid contracts.** `validateContracts` must be a blocking gate before `generateApp`. Currently P1 gap — do not bypass.
4. **Never write to a Client App database from the Control Plane.** Schema `dtfs` and schema `gen_<slug>` are fully separate. No cross-write.
5. **Never overwrite a `protected` GeneratedArtifact.** Currently `protected` is hardcoded `false` (known P0 bug) — do not make it harder to fix.
6. **Never introduce free-form JSONata** in new code. The Expr AST is the canonical expression system. The legacy `expr.ts` / `policy.ts` JSONata pile is a known debt item — do not extend it.
7. **Never mutate a project outside a ChangeSet.** The `changeset-middleware` enforces this on `/api/projects/:id/*` — do not route around it.

Full rules: [[AI_RULES]] · [[AI_DO_NOT_BREAK]]

---

## (d) Source of truth files

| Concept | File |
|---|---|
| Prisma schema (Control Plane) | `backend/prisma/schema.prisma` |
| DeltaSpec Zod + types | `backend/src/lib/dsl/delta-spec.ts` |
| Expr AST | `backend/src/lib/dsl/expr-ast.ts` |
| Operation DSL | `backend/src/lib/dsl/operation-dsl.ts` |
| Policy DSL | `backend/src/lib/dsl/policy-dsl.ts` |
| Contract compilation (backend) | `backend/src/lib/contracts/compile-backend.ts` |
| Contract compilation (frontend) | `backend/src/lib/contracts/compile-frontend.ts` |
| Contract compilation (shared) | `backend/src/lib/contracts/compile-shared.ts` |
| Codegen entry point | `backend/src/codegen/codegen.ts` |
| MCP tools registry | `backend/src/mcp.ts` |
| Guardrails | `backend/src/lib/guardrails.ts` |
| ChangeSet / Revision | `backend/src/changesets.ts` |
| SpecKit sync | `backend/src/lib/spec-kit-sync.ts` |
| Agent definitions | `.claude/agents/dtfs-*.md` |
| Slash commands | `.claude/commands/dtfs/` |
| Hooks config | `.claude/settings.json` |
| Audit report (read-only) | `docs/AUDIT_REPORT.md` |
| Architecture reference | `docs/ARCHITECTURE.md` |
