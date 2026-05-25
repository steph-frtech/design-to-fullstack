# Control Plane Pre-Apply Checklist

> Checklist to run before applying a DeltaSpec to the Control Plane.
> Reference: `docs/GOVERNANCE.md`, `docs/DELTA_SPEC.md`
>
> Every gate below must be green before calling `apply_spec` / `apply_delta_spec`.

---

## Gate 1 — Spec validity

- [ ] `dtfs__validate_delta_spec` passes with zero errors
- [ ] All Operation DSL expressions validated (`dtfs__validate_expression`)
- [ ] All Policy rules validated (`dtfs__validate_policy_rule`)
- [ ] No duplicate Entity or Operation names within the project

## Gate 2 — ChangeSet gate

- [ ] `dtfs__begin_changeset` has been called and returned a `changeSetId`
- [ ] The `changeSetId` is noted and will be passed to `apply_spec`
- [ ] No other ChangeSet is in `OPEN` status for this project

## Gate 3 — Requirement coverage

- [ ] Every Requirement in scope is referenced in the DeltaSpec
- [ ] Requirement status updated to `ACCEPTED` in the DeltaSpec
- [ ] No Requirement left in `PROPOSED` status without a mapping

## Gate 4 — Clarification gate

- [ ] No OpenQuestion row in status `OPEN`
- [ ] No Assumption row in status `OPEN`
- [ ] All resolved items have a `resolvedAt` timestamp

## Gate 5 — Proposal gate (Phase 6)

- [ ] PlatformSpecProposal status is `ACCEPTED` (not `DRAFT` or `PROPOSED`)
- [ ] DeltaSpec content is consistent with the accepted proposal

## Gate 6 — Governance

- [ ] Applies only additive changes (no destructive delete unless explicitly approved)
- [ ] Policy coverage: every Entity with mutable data has at least one ENTITY or ROW policy
- [ ] No orphan Operations (every Operation is reachable from a Screen or Trigger)

## Gate 7 — Review

- [ ] `dtfs-sdd-reviewer` has reviewed the SDD artifacts (Phase 4)
- [ ] `dtfs-spec-validator` has been run on the DeltaSpec (Phase 7 pre-apply)
- [ ] Human sign-off obtained for destructive changes (delete/update on existing entities)

---

**All gates green? Proceed with:**

```
dtfs__apply_delta_spec(changeSetId: "<cs-id>", deltaSpec: { ... })
```
