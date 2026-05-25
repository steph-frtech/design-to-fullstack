# Schema Inventory — dtfs

Generated: 2026-05-24 — Step 10 (Phase 10 enriched models)

All models live in the `dtfs` SQL schema. `currentVersion` column = versioned in `Revision` table.

## Auth / Session (better-auth compatible)

| Model        | Key columns                                          | Status        |
|--------------|------------------------------------------------------|---------------|
| User         | id, email, emailVerified, name, image                | typed V1      |
| Session      | id, userId FK, token, expiresAt                      | typed V1      |
| Account      | id, userId FK, providerId, accountId, tokens         | typed V1      |
| Verification | id, identifier, value, expiresAt                     | typed V1      |

## i18n

| Model        | Key columns                                          | Status        |
|--------------|------------------------------------------------------|---------------|
| Locale       | id, code unique, name, isDefault, enabled            | typed V1      |
| TextKey      | id, projectId FK, namespace, unique(projectId,ns)    | typed V1      |
| Translation  | id, textKeyId FK, localeId FK, value, currentVersion | typed V1      |

## Projects

| Model         | Key columns                                                       | Status   |
|---------------|-------------------------------------------------------------------|----------|
| Project       | id, slug unique, ownerId FK, defaultLocaleId FK, currentVersion   | typed V1 |
| ProjectLocale | (projectId, localeId) composite PK                                | typed V1 |
| Theme         | id, projectId unique FK, tokens Json, currentVersion              | typed V1 |

## Data Model

| Model        | Key columns                                                           | Status   |
|--------------|-----------------------------------------------------------------------|----------|
| Entity       | id, projectId FK, name, unique(projectId,name), currentVersion        | typed V1 |
| Attribute    | id, entityId FK, name, type FieldType, unique(entityId,name)          | typed V1 |
| EntityRecord | id, entityId FK, data Json, currentVersion                            | typed V1 |

## UI Definitions

| Model       | Key columns                                                          | Status   |
|-------------|----------------------------------------------------------------------|----------|
| Screen      | id, projectId FK, path, type?, order, currentVersion                 | typed V1 |
| Component   | id, screenId FK?, parentId FK?, type, config Json, currentVersion    | typed V1 |
| Form        | id, componentId unique FK, entityId?, operationId?, currentVersion   | typed V1 |
| Field       | id, formId FK, name, type FieldType, unique(formId,name)             | typed V1 |
| FieldOption | id, fieldId FK, value, labelKey, unique(fieldId,value)               | typed V1 |

## Versioning

| Model    | Key columns                                                    | Status   |
|----------|----------------------------------------------------------------|----------|
| Revision | id, entityType, entityId, version, op RevisionOp, data Json   | typed V1 |
| ChangeSet| id, projectId FK, message, actorId?, status ChangeSetStatus   | typed V1 |

## Control Plane V1

| Model          | Key columns                                                        | Status   |
|----------------|--------------------------------------------------------------------|----------|
| EntityRelation | id, projectId FK, fromEntityId FK, toEntityId FK, kind RelationKind| typed V1 |
| Resource       | id, projectId FK, entityId FK, name, exposedOps Json               | typed V1 |
| Operation      | id, projectId FK, name, kind OperationKind, inputSchema Json       | typed V1 |
| Policy         | id, projectId FK, name, scope PolicyScope, effect PolicyEffect     | typed V1 |
| Integration    | id, projectId FK, key, provider, capabilities Json                 | typed V1 |
| Trigger        | id, projectId FK, name, kind TriggerKind, operationId FK           | typed V1 |
| Behavior       | id, projectId FK, entityId FK, kind String                         | typed V1 |

## Phase 0 — Pipeline Skeleton

| Model              | Key columns                                                    | Status        |
|--------------------|----------------------------------------------------------------|---------------|
| ProductSpec        | id, projectId FK, title, description, targetUsers Json, goals Json | typed V1  |
| ScreenSpec         | id, projectId FK, productSpecId FK?, name, description         | typed V1      |
| OpenQuestion       | id, projectId FK, scope, question, status, answer?             | typed V1      |
| Assumption         | id, projectId FK, scope, text, status                          | typed V1      |
| SpecArtifact       | id, projectId FK, kind, content, contentHash                   | typed V1      |
| Requirement        | id, projectId FK, key unique(projectId,key), title, priority?  | typed V1      |
| RequirementMapping | id, projectId FK, requirementId FK, targetType, targetId       | typed V1      |

## Phase 6 — Platform Spec Proposal

| Model                | Key columns                                              | Status   |
|----------------------|----------------------------------------------------------|----------|
| PlatformSpecProposal | id, projectId FK, proposal Json, status, currentVersion  | typed V1 |

## Phase 10 — Full-Stack App Coverage (Step 10 additions)

| Model             | Key columns                                                                      | Status            |
|-------------------|----------------------------------------------------------------------------------|-------------------|
| Workflow          | id, projectId FK, name, inputSchema Json, steps Json, durability Json?, currentVersion | typed V1 (rich) |
| Asset             | id, projectId FK, name?, storage Json, mimeType, sizeBytes, contentHash, ownerId? FK User | typed V1 + Step10 |
| AuthMethod        | id, projectId FK, name, kind AuthMethodKind, config Json, currentVersion         | typed V1          |
| Secret            | id, projectId FK, key, vault Json, name?, refKind SecretRefKind?, path?, description? | typed V1 + Step10 |
| Environment       | id, projectId FK, name, overrides Json, config Json?, unique(projectId,name)     | typed V1 + Step10 |
| AppRole           | id, projectId FK, key, label, name?, description?, permissions Json              | typed V1 + Step10 |
| EventDefinition   | id, projectId FK, name, payloadSchema Json, schema Json?, description?           | typed V1 + Step10 |
| Action            | id, projectId FK, componentId?, kind String, targetType, name?, actionKind ActionKind?, target?, config Json? | typed V1 + Step10 |
| DataBinding       | id, projectId FK, componentId?, source Json, query Json, componentFkId? FK Component, sourceKind DataBindingSource?, expr Json?, targetProp? | typed V1 + Step10 |
| GeneratedArtifact | id, projectId FK, kind String, path, content, hash, changeSetId? FK ChangeSet, artifactKind GeneratedArtifactKind?, contentHash?, sizeBytes?, generatedAt? | typed V1 + Step10 |
| DeploymentTarget  | id, projectId FK, name, kind String, config Json, targetKind DeploymentTargetKind? | typed V1 + Step10 |
| TestScenario      | id, projectId FK, name, inputs Json, expected Json, scenarioKind TestScenarioKind?, steps Json?, scenarioStatus TestScenarioStatus? | typed V1 + Step10 |
| AuditLog          | id, projectId FK, actorId? FK User, kind, detail Json, action?, entityType?, entityId?, details Json? — append-only | typed V1 + Step10 |

## Enums

| Enum                  | Values                                        | Added in    |
|-----------------------|-----------------------------------------------|-------------|
| FieldType             | TEXT, TEXTAREA, EMAIL, PASSWORD, NUMBER, DATE… | V1          |
| RevisionOp            | CREATE, UPDATE, DELETE, RESTORE               | V1          |
| ChangeSetStatus       | DRAFT, APPLIED, REVERTED                      | V1          |
| RelationKind          | ONE_TO_ONE, ONE_TO_MANY, MANY_TO_MANY         | V1          |
| OperationKind         | QUERY, COMMAND, WORKFLOW                      | V1          |
| PolicyScope           | RESOURCE, OPERATION, ENTITY, FIELD            | V1          |
| PolicyEffect          | ALLOW, DENY                                   | V1          |
| TriggerKind           | EVENT, SCHEDULE, WEBHOOK                      | V1          |
| SpecArtifactKind      | CONSTITUTION, SPEC, PLAN, TASKS, NOTES        | V1 (unused — kind is String on model) |
| AuthMethodKind        | SESSION, BEARER, HMAC, APIKEY, API_KEY        | V1 + Step10 |
| SecretRefKind         | ENV, VAULT                                    | Step10      |
| ActionKind            | OPERATION, NAVIGATION, EVENT_EMIT, EXTERNAL_LINK | Step10   |
| DataBindingSource     | QUERY, OPERATION, STATIC                      | Step10      |
| GeneratedArtifactKind | CODE, MIGRATION, ASSET, TEST, DOCS            | Step10      |
| DeploymentTargetKind  | DEV, STAGING, PRODUCTION                      | Step10      |
| TestScenarioKind      | UNIT, INTEGRATION, E2E                        | Step10      |
| TestScenarioStatus    | DRAFT, ACTIVE, FAILING                        | Step10      |
