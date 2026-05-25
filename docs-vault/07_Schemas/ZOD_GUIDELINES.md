# ZOD_GUIDELINES

Conventions for Zod schemas in the DTFS codebase and the alignment rule between Zod and JSON Schema.

[[SCHEMA_GUIDELINES]] · [[JSON_SCHEMA_GUIDELINES]]

## Source of truth

`backend/src/lib/dsl/delta-spec.ts` — canonical DeltaSpec Zod schemas. `backend/src/lib/dsl/` — DSL validators (expr, operation, policy). Zod version: `^3.x` (declared in `backend/package.json`).

## AI usage

Always validate MCP tool inputs against the Zod schema before applying changes. Never bypass validation to apply a DeltaSpec directly to the DB. Use `dtfs__validate_delta_spec` or `deltaSpecSchema.parse()` before calling `dtfs__apply_spec`.

## Status

Active — conventions apply to all new Zod schemas.

---

## Naming

- Schema constants: `camelCaseNameSchema` (e.g. `productSpecInputSchema`, `deltaSpecSchema`)
- Inferred TypeScript types: `PascalCaseName` (e.g. `ProductSpecInput`, `DeltaSpec`)
- Patch schemas extend the input schema with `.partial().extend({ id: z.string() })`
- Ref schemas are `z.object({ id: z.string() })`

## Structure rules

1. **Input schemas** (`*InputSchema`): all fields that can be provided on create. Required fields have no `.optional()`. Optional fields use `.optional()` (not `.nullable()` unless the DB column is nullable).
2. **Patch schemas** (`*PatchSchema`): `inputSchema.partial().extend({ id: z.string() })`. Always require `id`.
3. **Ref schemas** (`*RefSchema` or `refSchema`): `z.object({ id: z.string() })`. Used in DeltaSpec `delete` arrays.
4. **Delta blocks**: use the `deltaBlock(createSchema, updateSchema)` factory from `delta-spec.ts`. Returns an optional object with `create?`, `update?`, `delete?` arrays.

## Where schemas live

| Layer | Location |
|-------|---------|
| DeltaSpec (all buckets) | `backend/src/lib/dsl/delta-spec.ts` |
| Expr DSL | `backend/src/lib/dsl/expr-ast.ts`, `expr-validate.ts` |
| Operation DSL | `backend/src/lib/dsl/operation-dsl.ts`, `operation-validate.ts` |
| Policy DSL | `backend/src/lib/dsl/policy-dsl.ts`, `policy-validate.ts` |
| Runtime contracts (design docs only) | `docs/{BACKEND,FRONTEND,SHARED}_CONTRACT.md` |
| HTTP request bodies | inline in `backend/src/app.ts`, `projects.ts`, `changesets.ts` |

## Alignment with JSON Schema

The rule: every Zod schema that is part of the public API surface (DeltaSpec buckets, contract shapes, resource/operation inputs) MUST have a corresponding JSON Schema file in `docs-vault/07_Schemas/schemas/`.

Steps to keep them aligned:
1. Change the Zod schema in TypeScript.
2. Run `zodToJsonSchema(updatedSchema)` to get the new JSON Schema.
3. Update the corresponding `schemas/*.schema.json` file.
4. Run `jq . docs-vault/07_Schemas/schemas/updated.schema.json` to confirm valid JSON.

Failure to update the JSON Schema is a documentation debt, not a runtime bug — but it breaks external tooling and contract testing.

## Common patterns

```ts
// Optional field with default
z.array(z.unknown()).default([])

// Discriminated union (avoid where possible — prefer separate schemas)
z.discriminatedUnion("kind", [schemaA, schemaB])

// Passthrough (for extensible top-level objects like DeltaSpec)
z.object({ ... }).passthrough()

// Record (arbitrary keys)
z.record(z.unknown())
```
