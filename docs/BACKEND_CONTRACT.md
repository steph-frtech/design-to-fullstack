# BackendContract

> Status: **design doc** — model does not exist in schema.prisma yet. Added in Phase 25.
> References: `RUNTIME_CONTRACTS_OVERVIEW.md`, `RUNTIME_TARGET.md`, `HONO_GENERATION.md`, `BETTER_AUTH_GENERATION.md`.

---

## What Is a BackendContract

A `BackendContract` is the compiled description of everything the backend must expose:
API routes, Zod schemas, auth configuration, policy middleware, error shapes.

It is produced by `compileBackendContract(projectId)` — a pure read pass over the Control Plane
(Entity, Attribute, Resource, Operation, Policy, AuthMethod, Asset, EventDefinition, Workflow, Trigger)
that maps each concept into a framework-agnostic descriptor.

The Hono emitter (Phase 28) reads `BackendContract` rows to generate actual TypeScript files.
It does NOT read the Control Plane directly.

---

## Model Shape (doc form — not yet in schema.prisma)

```
BackendContract {
  id              String   — cuid
  projectId       String   — FK Project
  runtimeTargetId String?  — FK RuntimeTarget (optional; scoped to a target)
  apiBasePath     String   — default "/api"
  routes          Json     — RouteDescriptor[]
  schemas         Json     — SchemaDescriptor[] (Zod + TypeScript)
  middlewares     Json?    — MiddlewareDescriptor[]
  auth            Json?    — BetterAuthConfigFragment
  errors          Json?    — ErrorDescriptor[]
  generatedFrom   Json?    — provenance: { entities[], operations[], policies[], authMethods[] }
  createdAt       DateTime
  updatedAt       DateTime
}
```

---

## Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Primary key |
| `projectId` | String | FK to `Project` |
| `runtimeTargetId` | String? | FK to `RuntimeTarget`; if null, uses the project default |
| `apiBasePath` | String | Root path for all API routes — default `"/api"` |
| `routes` | Json | Array of `RouteDescriptor` — one per Resource route family and Operation endpoint |
| `schemas` | Json | Array of `SchemaDescriptor` — Zod schemas + TypeScript types for all entities and DTOs |
| `middlewares` | Json? | Auth middleware, policy middleware, CORS, rate-limit descriptors |
| `auth` | Json? | Better Auth config fragment: providers, session, API-key, bearer |
| `errors` | Json? | Error code catalog with HTTP status and shape |
| `generatedFrom` | Json? | Provenance record: which Control Plane IDs contributed to this contract |
| `createdAt` / `updatedAt` | DateTime | Standard timestamps |

---

## Control Plane → BackendContract Mapping

| Control Plane concept | What it becomes in BackendContract |
|-----------------------|------------------------------------|
| `Entity` | Prisma model descriptor + Zod schema + TypeScript type + Repository descriptor + DTO + `/api/<entity>` resource family |
| `Attribute` | DB column descriptor + Zod field + validation rule + input/output DTO field |
| `Resource` | Family of Hono CRUD routes (`GET /api/<r>`, `GET /api/<r>/:id`, `POST`, `PATCH /:id`, `DELETE /:id`) filtered by `exposedOps` |
| `Operation` | Explicit Hono endpoint (`POST /api/operations/<name>`) with input schema, output schema, handler stub, policy checks, steps runner, error mapping |
| `Policy` | Hono middleware descriptor + permission check function descriptor |
| `AuthMethod` (SESSION) | Better Auth email/password config + `/api/auth/*` handler + session middleware descriptor |
| `AuthMethod` (API_KEY) | Better Auth API-key config + bearer middleware |
| `Asset` | `POST /api/assets`, `GET /api/assets/:id`, `GET /api/assets/:id/raw` route descriptors |
| `EventDefinition` | Typed event payload descriptor + emitter stub + test fixture stub |
| `Workflow` | Orchestration descriptor (planned — stub in Phase 25) |
| `Trigger` | Event → workflow link descriptor (planned — stub in Phase 25) |

---

## RouteDescriptor Shape

```jsonc
{
  "method": "GET" | "POST" | "PATCH" | "DELETE" | "PUT",
  "path": "/api/customers/:id",
  "kind": "resource" | "operation" | "auth" | "asset" | "system",
  "operationId": "getCustomer",               // camelCase, unique
  "inputSchema": "CustomerGetParams",          // ref to schemas[]
  "outputSchema": "CustomerResponse",          // ref to schemas[]
  "middlewares": ["requireSession", "isOwner"], // refs to middlewares[]
  "source": { "kind": "Resource", "id": "res_xxx" }
}
```

---

## SchemaDescriptor Shape

```jsonc
{
  "name": "CustomerSchema",
  "kind": "entity" | "input" | "output" | "dto" | "error",
  "zod": "z.object({ id: z.string(), email: z.string().email() })",
  "typescript": "type Customer = { id: string; email: string }",
  "source": { "kind": "Entity", "id": "ent_xxx" }
}
```

---

## Auth Config Fragment

When an `AuthMethod` of kind `SESSION` is present, the `auth` field contains:

```jsonc
{
  "provider": "better-auth",
  "basePath": "/api/auth",
  "emailPassword": true,
  "sessionDuration": 604800,
  "tables": ["user", "session", "account", "verification"],
  "middleware": "requireSession"
}
```

See `BETTER_AUTH_GENERATION.md` for how this fragment is compiled into `auth.ts`.

---

## Error Catalog

```jsonc
[
  { "code": "NOT_FOUND",     "httpStatus": 404, "shape": "{ error: string, id?: string }" },
  { "code": "FORBIDDEN",     "httpStatus": 403, "shape": "{ error: string }" },
  { "code": "UNAUTHORIZED",  "httpStatus": 401, "shape": "{ error: string }" },
  { "code": "VALIDATION",    "httpStatus": 422, "shape": "{ error: string, issues: ZodIssue[] }" },
  { "code": "CONFLICT",      "httpStatus": 409, "shape": "{ error: string }" },
  { "code": "SERVER_ERROR",  "httpStatus": 500, "shape": "{ error: string }" }
]
```

These are written into `packages/shared/src/errors.ts` via `SharedContract`.

---

## Compilation Steps

`compileBackendContract(projectId)` runs in this order:

1. Load `RuntimeTarget` for the project.
2. Load all Control Plane entities: Entity, Attribute, EntityRelation, Resource, Operation, Policy, AuthMethod, Asset, EventDefinition.
3. For each Entity → emit schema descriptor + DTO descriptors.
4. For each Resource → emit route family (filtered by `exposedOps`).
5. For each Operation → emit explicit POST endpoint.
6. For each Policy → emit middleware descriptor.
7. For each AuthMethod → emit auth config fragment + session middleware.
8. For each Asset → emit asset route descriptors.
9. For each EventDefinition → emit event payload descriptor.
10. Collect all errors → emit error catalog.
11. Write `BackendContract` row to DB (or update if one already exists for this project + target).

---

## Generated From (Provenance)

```jsonc
{
  "entities":    ["ent_aaa", "ent_bbb"],
  "operations":  ["op_createCustomer", "op_sendInvoice"],
  "policies":    ["pol_isOwner", "pol_isAdmin"],
  "authMethods": ["am_session"],
  "resources":   ["res_customers", "res_invoices"],
  "assets":      [],
  "events":      ["evt_invoicePaid"]
}
```

This provenance is used by Phase 29 to diff contracts across versions and to report
which Control Plane changes invalidate which contract fields.

---

## Related Docs

- `RUNTIME_TARGET.md` — the RuntimeTarget that parameterizes this contract
- `RUNTIME_CONTRACTS_OVERVIEW.md` — the overall architecture
- `SHARED_CONTRACT.md` — shared types derived from BackendContract schemas
- `HONO_GENERATION.md` — how BackendContract.routes → Hono TypeScript files
- `BETTER_AUTH_GENERATION.md` — how BackendContract.auth → Better Auth runtime
- `GENERATED_ARTIFACTS.md` — how generated files are tracked
