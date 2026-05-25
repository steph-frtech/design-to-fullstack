# DeltaSpec Production Checklist

> Template/checklist for producing a canonical DeltaSpec.
> Reference: `docs/DELTA_SPEC.md`
>
> A DeltaSpec is the **only authorised format** for modifying the Control Plane.
> Flow: `DeltaSpec → validate_spec → apply_spec → ChangeSet`

---

## Pre-conditions

- [ ] A PlatformSpecProposal exists with status `ACCEPTED` (Phase 6 complete)
- [ ] All Requirements in scope have status `ACCEPTED`
- [ ] No unresolved OpenQuestion rows in status `OPEN`
- [ ] The ChangeSet gate is open: `dtfs__begin_changeset` has been called

## DeltaSpec skeleton

```yaml
# DeltaSpec — project: <project-id>
# Feature: <feature-name>
# Author: <agent or human>
# Date: <YYYY-MM-DD>

productSpecs:
  update:
    - id: "<ps-id>"
      # patch fields only

screenSpecs:
  create:
    - name: "<ScreenName>"
      # ...
  update:
    - id: "<ss-id>"
      # patch fields only

requirements:
  update:
    - id: "<req-id>"
      status: ACCEPTED

entities:
  create:
    - name: "<EntityName>"
      description: "<what this entity represents>"
      attributes:
        - name: "<attr>"
          type: TEXT | INT | BOOL | FLOAT | JSON | DATETIME
          required: true | false
          unique: false
      behaviors:
        - ownable
  update:
    - id: "<ent-id>"
      # patch fields only

relations:
  create:
    - fromEntityId: "<ent-a-id>"
      toEntityId: "<ent-b-id>"
      cardinality: ONE_TO_MANY | MANY_TO_MANY | ONE_TO_ONE

operations:
  create:
    - name: "<operationName>"
      entityId: "<ent-id>"
      kind: QUERY | MUTATION | ACTION
      trigger: FORM | EVENT | SCHEDULE
      description: "<what this operation does>"

policies:
  create:
    - name: "<policyName>"
      kind: ENTITY | OPERATION | ROW
      condition: "<DSL expression>"
      description: "<what this policy enforces>"

screens:
  create:
    - name: "<ScreenName>"
      type: PAGE | MODAL | DRAWER | TAB
      # ...
```

## Post-apply checklist

- [ ] `dtfs__validate_delta_spec` returned no errors before apply
- [ ] ChangeSet committed with status `COMMITTED`
- [ ] Revisions created for each modified artifact
- [ ] `dtfs__generate_app` run (if codegen phase reached)
- [ ] SDD artifacts updated to reflect applied spec

## Notes

> Record any deviations from the PlatformSpecProposal here.
