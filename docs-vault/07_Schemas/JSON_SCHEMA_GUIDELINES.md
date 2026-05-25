# JSON_SCHEMA_GUIDELINES

Conventions for all JSON Schema files in `docs-vault/07_Schemas/schemas/`.

[[SCHEMA_GUIDELINES]] · [[ZOD_GUIDELINES]] · [[06_API/OPENAPI_GUIDELINES]]

## Source of truth

JSON Schema specification: https://json-schema.org/draft/2020-12 · OpenAPI 3.1 schema dialect: https://spec.openapis.org/oas/3.1/dialect/base

## AI usage

When generating or validating JSON Schema files, use draft 2020-12. The keywords `$schema`, `$id`, `title`, `type`, `properties`, `required`, and `additionalProperties` are mandatory for every top-level object schema.

## Status

Active — conventions apply to all new schema files.

---

## Required header

Every schema file MUST start with:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://dtfs.dev/schemas/<filename-without-extension>",
  "title": "<HumanReadableName>",
  "description": "<one sentence>",
  "type": "object"
}
```

The `$id` uses the `https://dtfs.dev/schemas/` namespace as a stable identifier. The URI does not need to resolve to a live URL.

## Property conventions

- `"required"`: list all fields that are never nullable in normal usage. Optional fields are omitted from `required` and typed with `oneOf: [{type: "..."}, {type: "null"}]` when null is possible, or simply absent from `required` when they are genuinely optional.
- `"additionalProperties": false`: use on all schemas where the shape is stable and closed. Omit on schemas that intentionally accept arbitrary extension fields (e.g. `DeltaSpec` which uses `.passthrough()`).
- `"$ref"`: prefer inline definitions over `$ref` for leaf schemas to keep files self-contained. Use `$ref` to `$defs` for repeated sub-shapes within the same file.
- Arrays of objects: define the item shape under `"$defs"` and reference with `"$ref"`.

## Validation tooling

```bash
# Validate a schema file itself
npx ajv compile -s docs-vault/07_Schemas/schemas/foo.schema.json --spec=draft2020

# Validate a document against a schema
npx ajv validate -s docs-vault/07_Schemas/schemas/foo.schema.json -d path/to/document.json --spec=draft2020

# Pretty-print / syntax check
jq . docs-vault/07_Schemas/schemas/foo.schema.json
```

## Mapping from Zod to JSON Schema

Use `zod-to-json-schema` (already a dev dep or installable as needed):

```ts
import { zodToJsonSchema } from "zod-to-json-schema";
import { deltaSpecSchema } from "backend/src/lib/dsl/delta-spec";
console.log(JSON.stringify(zodToJsonSchema(deltaSpecSchema, { $refStrategy: "none" }), null, 2));
```

The output is draft 2020-12 compatible and can be pasted directly into a schema file (add `$id`, `title`, `description` header).
