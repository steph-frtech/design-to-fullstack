# Platform Mapping Template

> Template: Requirements → Control Plane targets
> Reference: `docs/SPECKIT_INTEGRATION.md`, `docs/OPERATION_DSL.md`, `docs/POLICY_DSL.md`

Fill one block per Requirement. Delete rows that do not apply.

---

## Mapping: `<requirement-id>` — `<requirement-title>`

**Source**: `spec.md` / `tasks.md` / `constitution.md` (Phase 4 SDD artifact)
**Status**: DRAFT | PROPOSED | ACCEPTED | REJECTED

### Entity targets

| Entity name | Action | Notes |
|---|---|---|
| `<EntityName>` | create / update / extend | |

### Attribute targets

| Entity | Attribute | Type | Required | Notes |
|---|---|---|---|---|
| `<EntityName>` | `<attributeName>` | TEXT / INT / BOOL / ... | yes / no | |

### Operation targets

| Operation name | Kind | Entity | Trigger | Notes |
|---|---|---|---|---|
| `<operationName>` | QUERY / MUTATION / ACTION | `<EntityName>` | FORM / EVENT / SCHEDULE | |

### Policy targets

| Policy name | Kind | Condition (DSL) | Notes |
|---|---|---|---|
| `<policyName>` | ENTITY / OPERATION / ROW | `<expr>` | |

### Screen targets

| Screen name | Action | Notes |
|---|---|---|
| `<ScreenName>` | create / update / extend | |

### Relation targets

| From | To | Cardinality | Notes |
|---|---|---|---|
| `<EntityA>` | `<EntityB>` | ONE_TO_MANY / MANY_TO_MANY | |

### Behavior targets

| Behavior | Entity | Notes |
|---|---|---|
| `ownable` / `auditable` / `softDeletable` / ... | `<EntityName>` | |

### Open questions / assumptions

- [ ] `<question or assumption>`

---

<!-- Repeat above block for each Requirement -->
