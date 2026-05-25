# SharedContract

> Status: **design doc** — model does not exist in schema.prisma yet. Added in Phase 25.
> References: `RUNTIME_CONTRACTS_OVERVIEW.md`, `BACKEND_CONTRACT.md`, `FRONTEND_CONTRACT.md`, `SDK_GENERATION.md`.

---

## What Is a SharedContract

A `SharedContract` is the bridge between backend and frontend.
It compiles the types, Zod schemas, API client surface, error codes, and event payloads that both sides of the application share.

Concretely, `SharedContract` drives the generation of `packages/shared/` in the output monorepo —
the single package imported by both `apps/api/` and `apps/web/`.

It is produced by `compileSharedContract(projectId)` — a read pass over the same Control Plane
data used by `compileBackendContract` and `compileFrontendContract`.

---

## Model Shape (doc form — not yet in schema.prisma)

```
SharedContract {
  id          String   — cuid
  projectId   String   — FK Project
  types       Json     — TypeDescriptor[] (Entity DTOs, API responses, errors)
  schemas     Json     — ZodSchemaDescriptor[] (input/output validation)
  apiClient   Json?    — ApiClientDescriptor[] (frontend → backend function signatures)
  errors      Json?    — ErrorTypeDescriptor[] (error code enum + shapes)
  events      Json?    — EventPayloadDescriptor[] (typed event payloads)
  createdAt   DateTime
  updatedAt   DateTime
}
```

---

## Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Primary key |
| `projectId` | String | FK to `Project` |
| `types` | Json | TypeScript `type` and `interface` declarations for all entities, DTOs, and API response shapes |
| `schemas` | Json | Zod schema declarations: input schemas for operations, output schemas, entity schemas |
| `apiClient` | Json? | Typed API client function signatures (the SDK surface; see `SDK_GENERATION.md`) |
| `errors` | Json? | Error code enum definition + per-code shape type |
| `events` | Json? | Event payload type definitions for all `EventDefinition` rows |
| `createdAt` / `updatedAt` | DateTime | Standard timestamps |

---

## Contents by Source

| Item | Derived from Control Plane |
|------|---------------------------|
| Entity DTO types | `Entity.attributes` — TypeScript `interface` with all fields, optional nullable |
| Input DTOs | `Operation.inputSchema` + `Form.fields` — `z.object(...)` input type |
| Output DTOs | `Operation.outputSchema` — TypeScript `type` for response payload |
| API response types | `Resource.exposedOps` → standard CRUD response shapes |
| API error types | `BackendContract.errors` → `ErrorCode` enum + `ApiError<Code>` type |
| Auth session type | `AuthMethod` → Better Auth session shape (`Session`, `User`) |
| Role type | `AppRole` keys → `AppRoleKey` union type |
| Event payload types | `EventDefinition.payloadSchema` → typed `interface EventPayload<Name>` |
| Zod schemas | All of the above, expressed as `z.object(...)` for runtime validation |

---

## TypeDescriptor Shape

```jsonc
{
  "name": "Customer",
  "kind": "entity" | "input" | "output" | "error" | "session" | "role" | "event",
  "typescript": "export interface Customer { id: string; email: string; name: string; createdAt: Date }",
  "source": { "kind": "Entity", "id": "ent_xxx" }
}
```

---

## ZodSchemaDescriptor Shape

```jsonc
{
  "name": "CustomerSchema",
  "kind": "entity" | "input" | "output",
  "zod": "export const CustomerSchema = z.object({ id: z.string(), email: z.string().email(), name: z.string() })",
  "source": { "kind": "Entity", "id": "ent_xxx" }
}
```

---

## ApiClientDescriptor Shape

```jsonc
{
  "name": "getCustomer",
  "method": "GET",
  "path": "/api/customers/:id",
  "params": { "id": "string" },
  "inputSchema": null,
  "outputSchema": "CustomerResponse",
  "signature": "getCustomer(id: string): Promise<CustomerResponse>",
  "source": { "kind": "Resource", "id": "res_customers", "op": "getById" }
}
```

These descriptors drive generation of `packages/shared/src/api-contract.ts` and the typed client
in `apps/web/lib/api/`. See `SDK_GENERATION.md` for details.

---

## Error Type Descriptor Shape

```jsonc
{
  "enum": "export type ErrorCode = 'NOT_FOUND' | 'FORBIDDEN' | 'UNAUTHORIZED' | 'VALIDATION' | 'CONFLICT' | 'SERVER_ERROR'",
  "types": [
    { "code": "NOT_FOUND",    "shape": "export interface NotFoundError { error: 'NOT_FOUND'; id?: string }" },
    { "code": "VALIDATION",   "shape": "export interface ValidationError { error: 'VALIDATION'; issues: ZodIssue[] }" }
  ]
}
```

---

## Event Payload Descriptor Shape

```jsonc
{
  "name": "InvoicePaidPayload",
  "typescript": "export interface InvoicePaidPayload { invoiceId: string; amount: number; paidAt: Date }",
  "zod": "export const InvoicePaidPayloadSchema = z.object({ invoiceId: z.string(), amount: z.number(), paidAt: z.date() })",
  "source": { "kind": "EventDefinition", "id": "evt_invoicePaid" }
}
```

---

## Generated Package Structure

`SharedContract` drives generation of `packages/shared/` (see `SDK_GENERATION.md`):

```
packages/shared/
  src/
    types/
      customer.ts          ← Customer, CustomerInput, CustomerResponse
      invoice.ts           ← Invoice, …
      index.ts             ← re-export barrel
    schemas/
      customer.ts          ← CustomerSchema, CustomerInputSchema
      invoice.ts
      index.ts
    errors.ts              ← ErrorCode enum + error shapes
    api-contract.ts        ← API client function signatures (typed SDK)
    events.ts              ← event payload types
    index.ts               ← public API
  package.json
  tsconfig.json
```

---

## Compilation Steps

`compileSharedContract(projectId)` runs in this order:

1. Read `BackendContract` for this project (must exist — compile it first).
2. Read `FrontendContract` for this project (must exist — compile it first).
3. For each `Entity` → emit TypeDescriptor (interface) + ZodSchemaDescriptor.
4. For each `Operation.inputSchema` / `outputSchema` → emit input/output TypeDescriptor + ZodSchemaDescriptor.
5. For each `Resource.exposedOps` → emit CRUD response TypeDescriptors.
6. From `BackendContract.errors` → emit ErrorTypeDescriptor.
7. From `AuthMethod` → emit session type + user type.
8. From `AppRole` → emit role union type.
9. From `EventDefinition` → emit event payload TypeDescriptor + ZodSchemaDescriptor.
10. From `BackendContract.routes` → emit ApiClientDescriptors.
11. Write `SharedContract` row to DB.

---

## Compile Order Dependency

```
compileBackendContract(projectId)
  ↓
compileFrontendContract(projectId)
  ↓
compileSharedContract(projectId)   ← reads from both
  ↓
validateContracts(projectId)       ← gate check
  ↓
generate code
```

`SharedContract` must be compiled AFTER `BackendContract` because it reads the error catalog and route table from it.

---

## Related Docs

- `RUNTIME_TARGET.md` — the RuntimeTarget that parameterizes compilation
- `RUNTIME_CONTRACTS_OVERVIEW.md` — the overall architecture
- `BACKEND_CONTRACT.md` — source of error catalog + route table
- `FRONTEND_CONTRACT.md` — source of form schemas + action descriptors
- `SDK_GENERATION.md` — how SharedContract → `packages/shared/` TypeScript files
- `GENERATED_ARTIFACTS.md` — how generated files are tracked
