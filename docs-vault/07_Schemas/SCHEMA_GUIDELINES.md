# SCHEMA_GUIDELINES

Overview of schema strategy in the DTFS vault: where schemas live, which format is used for what, and how JSON Schema and Zod stay aligned.

[[JSON_SCHEMA_GUIDELINES]] · [[ZOD_GUIDELINES]] · [[06_API/OPENAPI_GUIDELINES]]

## Source of truth

Zod schemas in `backend/src/lib/dsl/delta-spec.ts` are the primary runtime source of truth for all DeltaSpec shapes. Contract shapes are documented in `docs/{BACKEND,FRONTEND,SHARED}_CONTRACT.md`. JSON Schema files in this vault (`schemas/`) are derived documentation artifacts.

## AI usage

Use Zod schemas directly in TypeScript code. Reference JSON Schema files for external validation tooling (ajv, Postman, OpenAPI linting). Never import JSON Schema files at runtime.

## Status

Placeholder — schemas are manually maintained and enriched progressively.

---

## Two layers

### Zod (runtime, TypeScript)

- Lives in `backend/src/lib/dsl/` and `backend/src/lib/contracts/`
- Used at runtime for request validation, MCP tool input parsing, and DeltaSpec application
- Exported as named `*Schema` constants; TypeScript types inferred via `z.infer<>`
- Source of truth for: DeltaSpec buckets, operation/policy/resource inputs, all CRUD bodies

### JSON Schema (external / documentation)

- Lives in `docs-vault/07_Schemas/schemas/`
- Used for: OpenAPI `components/schemas`, external validators, Postman collections, schema registries
- Format: JSON Schema draft 2020-12 (`"$schema": "https://json-schema.org/draft/2020-12/schema"`)
- Generated from Zod via `zod-to-json-schema` (or manually for contract shapes not yet in Zod)
- See [[JSON_SCHEMA_GUIDELINES]] for format conventions

## Alignment rule

When a Zod schema changes, the corresponding JSON Schema file in `schemas/` MUST be updated in the same PR. The canonical check is: `zod-to-json-schema(ZodSchema)` should produce output structurally equivalent to the JSON Schema file.

## Schema inventory

| Concept | Zod source | JSON Schema file |
|---------|-----------|-----------------|
| DeltaSpec | `delta-spec.ts:deltaSpecSchema` | `schemas/delta-spec.schema.json` |
| ProductSpec | `delta-spec.ts:productSpecInputSchema` | `schemas/product-spec.schema.json` |
| ScreenSpec | `delta-spec.ts:screenSpecInputSchema` | `schemas/screen-spec.schema.json` |
| RuntimeTarget | `docs/RUNTIME_TARGET.md` (design doc) | `schemas/runtime-target.schema.json` |
| BackendContract | `docs/BACKEND_CONTRACT.md` (design doc) | `schemas/backend-contract.schema.json` |
| FrontendContract | `docs/FRONTEND_CONTRACT.md` (design doc) | `schemas/frontend-contract.schema.json` |
| SharedContract | `docs/SHARED_CONTRACT.md` (design doc) | `schemas/shared-contract.schema.json` |
| GeneratedArtifact | `docs/GENERATED_ARTIFACTS.md` + schema.prisma | `schemas/generated-artifact.schema.json` |
