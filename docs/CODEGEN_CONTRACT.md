# Codegen Contract

Codegen is layer 9 of the pipeline — the moment the Control Plane's
declarative state becomes an actual Hono / Prisma / Next.js codebase.

V1 does NOT implement codegen. This document fixes the **contract** so
V3 can be written without retrofitting the model.

## Input — what codegen consumes

The codegen pass reads the **fully-resolved spec** of a project :

```
GET /api/projects/:id/spec     → JSON
```

Plus, computed in-process before generation :

1. **Behavior expansion** — every `Behavior` is replaced by the
   Resources/Operations/Policies/Attributes/Relations it represents.
   The expanded form is what codegen actually consumes (no Behavior
   leaks into the generated code).

2. **Translation resolution** — every `*Key` field (nameKey, labelKey,
   etc.) is dereferenced. The generated app embeds the strings inline
   for the default locale + an i18n file for the others.

3. **Reference flattening** — every cross-concept reference (Form →
   Operation, Trigger → Operation, etc.) is verified and inlined.

The output of this pre-pass is an **internal `PlatformSpec`** shape
(see below) — never persisted, recomputed each codegen run.

## Output — what codegen produces

Per project, a directory tree :

```
gen/<project-slug>/
├── README.md
├── package.json
├── pnpm-workspace.yaml
├── backend/
│   ├── package.json
│   ├── prisma/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── app.ts            ← Hono routes from Resources + Operations
│   │   ├── auth.ts           ← AuthMethod[] → better-auth setup
│   │   ├── policies.ts       ← Policy DSL → middleware
│   │   ├── integrations/
│   │   │   ├── stripe.ts
│   │   │   └── ...
│   │   ├── workflows/        ← Operation kind=WORKFLOW → Temporal (V3)
│   │   ├── triggers.ts       ← Trigger[] → cron / webhook handlers
│   │   └── events.ts         ← EventDefinition[] → event bus
├── frontend/
│   ├── package.json
│   └── src/app/
│       ├── layout.tsx        ← Theme tokens
│       ├── (pages…)          ← Screen[] → Next.js pages
│       └── api/              ← RPC client typed from backend AppType
├── assets/                   ← Asset[] uploaded files
└── tests/                    ← TestScenario[] → vitest/playwright
```

Each file is recorded in `GeneratedArtifact { path, content, hash }`
for drift detection. Re-running codegen :

1. Computes the new PlatformSpec from the Control Plane.
2. Generates each file's content.
3. Diffs against the stored `GeneratedArtifact.hash`.
4. Reports drift if the on-disk file diverges from the stored hash
   (= hand-edited).
5. Writes / refuses to overwrite based on the drift policy.

## The internal `PlatformSpec`

```ts
type PlatformSpec = {
  project:       ProjectMeta;
  entities:      EntityExpanded[];   // includes Behavior expansions
  resources:     ResourceExpanded[];
  operations:    OperationExpanded[]; // QUERY/COMMAND only; WORKFLOW → workflows[]
  workflows:     WorkflowExpanded[];
  policies:      PolicyExpanded[];
  integrations:  IntegrationExpanded[];
  triggers:      TriggerExpanded[];
  events:        EventDefinitionExpanded[];
  authMethods:   AuthMethodExpanded[];
  secrets:       SecretRef[];        // references only, never values
  appRoles:      AppRoleExpanded[];
  environments:  EnvironmentExpanded[];
  screens:       ScreenExpanded[];
  forms:         FormExpanded[];     // each links to its Operation
  actions:       ActionExpanded[];
  dataBindings:  DataBindingExpanded[];
  assets:        AssetMeta[];
  testScenarios: TestScenarioExpanded[];
};
```

"Expanded" = post-resolution, ready to be templated into code. Each
sub-type is documented inline as JSDoc in the codegen module (V3).

## Generation order

Same dependency order as DeltaSpec apply :

1. Prisma schema (`backend/prisma/schema.prisma`)
2. Migration (one big file from delta with previous gen)
3. Policies (`backend/src/policies.ts`)
4. Integrations (`backend/src/integrations/*.ts`)
5. Operations (`backend/src/operations/*.ts` and routes in `app.ts`)
6. Resources (CRUD scaffolds in `app.ts`)
7. Triggers + Workflows (handlers + Temporal definitions)
8. Auth + Roles (`auth.ts`)
9. Frontend (Screens, Components, Forms, Theme, i18n)
10. Tests

## Determinism

Same Control Plane state + same codegen version = byte-identical output.
This is enforced by :

- Fixed iteration order (sort by `name` everywhere).
- No timestamps in generated code (only in `GeneratedArtifact.createdAt`).
- No env-dependent paths (relative paths only).
- Pinned formatter version.

## Drift policy

| Setting          | Behavior                                              |
|------------------|-------------------------------------------------------|
| `strict`         | Refuses to overwrite if file hash differs. Codegen fails.  |
| `merge`          | Re-runs but writes to `<file>.gen` parallel file.     |
| `force`          | Overwrites unconditionally.                           |
| `interactive`    | Prompts the user per drifted file (Phase 13 work).    |

Default in V3 : `interactive`. CI in production : `strict`.

## Re-codegen triggers

The codegen is triggered :
- Manually : `dtfs__regenerate(projectId)` MCP tool (V3)
- Automatically : after every `ChangeSet.commit` (configurable)
- Via webhook : when a Spec Kit artifact changes

## What codegen does NOT do

- **Run migrations on the generated DB** — that's a separate step
  (`dtfs__migrate_generated_db`). Codegen only writes the migration
  files.
- **Deploy** — the generated repo is shippable, but the platform doesn't
  auto-deploy. `DeploymentTarget` rows configure the deploy commands,
  but executing them is opt-in.
- **Modify user code** outside the generated paths. Files under
  `<gen>/custom/` (V3 convention) are never touched.

## Test scenario → test code

Each `TestScenario` row produces one or more test files :

| TestScenario.kind | Generated path                                                  |
|-------------------|-----------------------------------------------------------------|
| `unit`            | `tests/unit/<operation>.test.ts` (vitest)                       |
| `integration`     | `tests/integration/<operation>.test.ts`                         |
| `e2e`             | `tests/e2e/<screen>.spec.ts` (playwright)                       |
| `contract`        | `tests/contract/<resource>.test.ts` (uses generated RPC client) |
| `golden`          | snapshot test against the spec.json                             |

The test bodies are filled by an LLM agent (`dtfs-test-author`,
V3 work) — codegen just creates the skeleton + fixtures.
