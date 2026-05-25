# OPENAPI_GUIDELINES

How OpenAPI specs are written and maintained in the DTFS vault.
All specs use OpenAPI 3.1.0. Schemas are derived from Zod definitions in the codebase and aligned with JSON Schema draft 2020-12 for external consumers.

[[CONTROL_PLANE_API]] · [[GENERATED_CLIENT_API]] · [[07_Schemas/SCHEMA_GUIDELINES]]

## Source of truth

The authoritative Zod schemas live in `backend/src/lib/dsl/delta-spec.ts` and the contract doc files in `docs/`. OpenAPI specs in this vault are documentation artifacts — they are manually maintained to stay in sync with those sources, not auto-generated.

## AI usage

AI agents (dtfs-*) MUST use the Zod schemas directly. These OpenAPI files are for human documentation and external tooling (Swagger UI, Postman, contract testing). Do not treat them as executable specs.

## Status

Placeholder — enriched progressively as the Control Plane stabilises.

---

## OpenAPI 3.1 conventions

- All specs declare `openapi: "3.1.0"` as the first key.
- `info.version` tracks the DTFS phase (e.g. `"0.26.0"` for Phase 26).
- All schemas live under `components/schemas` and are referenced with `$ref: "#/components/schemas/Foo"`.
- `operationId` values are camelCase and globally unique within a file.
- Responses always declare at least a `"200"` or `"201"` entry; error shapes (`"400"`, `"404"`, `"422"`) reference `components/schemas/ApiError`.
- Paths document the canonical URL (alias paths are noted in descriptions, not duplicated as separate path objects).

## Relationship with Zod and JSON Schema

OpenAPI 3.1 schemas are a strict subset of JSON Schema draft 2020-12.
The mapping rule is: **Zod schema → JSON Schema (via `zod-to-json-schema`) → OpenAPI `components/schemas` entry**.

When a Zod schema changes, the corresponding `components/schemas` entry in the relevant `.openapi.yaml` must be updated in the same PR.

## Generating the frontend API client

The frontend (`frontend/web/`) uses `hono/client` for end-to-end type-safe RPC, NOT a generated OpenAPI client.
The `generated-client-api.openapi.yaml` is documentation-only — it describes the surface that `BackendContract` produces so that human readers and external tools can understand the generated app's API.

If a code-generated client is ever needed (e.g. for a mobile app), run:
```
openapi-ts --input docs-vault/06_API/openapi/generated-client-api.openapi.yaml --output packages/sdk-client/src --client fetch
```
