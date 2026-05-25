# SDK Generation

> Status: **design doc** — new emitter (`emit-shared-sdk.ts`) begins in Phase 28.
> References: `SHARED_CONTRACT.md`, `BACKEND_CONTRACT.md`, `RUNTIME_TARGET.md`, `GENERATED_ARTIFACTS.md`.

---

## What This Doc Covers

How `SharedContract` → `packages/shared/` TypeScript package — the typed SDK consumed by
both `apps/api/` (backend) and `apps/web/` (frontend).

---

## Why a Shared Package

Without a shared package, types and schemas exist in two places: the backend defines them for
validation, the frontend duplicates them for form validation. Drift between the two causes
runtime errors.

The SDK package is the single source of truth:
- Backend: imports schemas for input validation + uses TypeScript types in handlers.
- Frontend: imports schemas for form validation + uses TypeScript types in components.
- API client: typed functions derived from `BackendContract.routes` via `hono/client`.

---

## Generated Package Structure

```
packages/shared/
  src/
    types/
      index.ts               ← re-export barrel
      customer.ts            ← Customer, CustomerInput, CustomerResponse
      invoice.ts             ← Invoice, …
      auth.ts                ← AuthSession, AuthUser
      roles.ts               ← AppRoleKey union type
      events.ts              ← InvoicePaidPayload, …
    schemas/
      index.ts               ← re-export barrel
      customer.ts            ← CustomerSchema, CustomerInputSchema
      invoice.ts
      auth.ts                ← (no Zod schemas for session — handled by Better Auth)
    errors.ts                ← ErrorCode enum + error type shapes
    api-contract.ts          ← API client function signatures
    index.ts                 ← public API of the package
  package.json
  tsconfig.json
```

---

## types/<entity>.ts Pattern

```ts
// Generated — packages/shared/src/types/customer.ts
export interface Customer {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerInput {
  email: string;
  name: string;
}

export interface CustomerResponse {
  id: string;
  email: string;
  name: string;
  createdAt: string; // ISO 8601 over JSON
}

export type CustomerListResponse = CustomerResponse[];
```

Types are generated from `SharedContract.types`. `CustomerInput` corresponds to the `Operation.inputSchema`
for create/update operations; `CustomerResponse` to the `outputSchema`.

---

## schemas/<entity>.ts Pattern

```ts
// Generated — packages/shared/src/schemas/customer.ts
import { z } from "zod";

export const CustomerSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().min(1),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const CustomerInputSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
});

export const CustomerUpdateSchema = CustomerInputSchema.partial();

export type CustomerInput = z.infer<typeof CustomerInputSchema>;
export type CustomerUpdate = z.infer<typeof CustomerUpdateSchema>;
```

---

## errors.ts Pattern

```ts
// Generated — packages/shared/src/errors.ts
export type ErrorCode =
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "UNAUTHORIZED"
  | "VALIDATION"
  | "CONFLICT"
  | "SERVER_ERROR";

export interface ApiError<Code extends ErrorCode = ErrorCode> {
  error: Code;
}

export interface ValidationApiError extends ApiError<"VALIDATION"> {
  issues: Array<{ path: string[]; message: string }>;
}

export interface NotFoundApiError extends ApiError<"NOT_FOUND"> {
  id?: string;
}
```

Derived from `SharedContract.errors`.

---

## api-contract.ts Pattern

The API contract is generated from `SharedContract.apiClient` — one typed function signature
per `RouteDescriptor` in `BackendContract.routes`.

```ts
// Generated — packages/shared/src/api-contract.ts
//
// These are signatures, not implementations.
// The actual fetch calls are in apps/web/lib/api/*.ts.

export type ApiContract = {
  // Customers
  "GET /api/customers":      () => Promise<CustomerListResponse>;
  "GET /api/customers/:id":  (id: string) => Promise<CustomerResponse | null>;
  "POST /api/customers":     (data: CustomerInput) => Promise<CustomerResponse>;
  "PATCH /api/customers/:id":(id: string, data: CustomerUpdate) => Promise<CustomerResponse | null>;
  "DELETE /api/customers/:id":(id: string) => Promise<{ ok: boolean }>;

  // Operations
  "POST /api/operations/createCustomer": (data: CreateCustomerInput) => Promise<CreateCustomerOutput>;
};
```

This contract type is used by the frontend SDK client implementation for type-checking.

---

## Frontend SDK Client (`apps/web/lib/api/`)

The frontend SDK is generated separately from `SharedContract.apiClient` and uses the Hono RPC
client (`hono/client`) for full end-to-end type safety:

```ts
// Generated — apps/web/lib/api/index.ts
import { hc } from "hono/client";
import type { AppType } from "../../api/src/index"; // imported type from backend

const client = hc<AppType>(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000");

export const customersApi = {
  list:     () => client.api.customers.$get(),
  getById:  (id: string) => client.api.customers[":id"].$get({ param: { id } }),
  create:   (data: CustomerInput) => client.api.customers.$post({ json: data }),
  update:   (id: string, data: CustomerUpdate) =>
              client.api.customers[":id"].$patch({ param: { id }, json: data }),
  delete:   (id: string) => client.api.customers[":id"].$delete({ param: { id } }),
};
```

When the frontend uses this client, TypeScript infers the correct request/response types from
`AppType` — the type-level contract of the Hono application.

---

## Hono Client vs. REST Fetch

Two strategies are possible depending on the `RuntimeTarget.config`:

| Strategy | `RuntimeTarget.config.sdkStyle` | Description |
|----------|--------------------------------|-------------|
| `hono-client` (default) | `"hono-rpc"` | `hc<AppType>(...)` — fully typed via Hono |
| `fetch` | `"rest-fetch"` | Plain `fetch` calls with manual typing from `ApiContract` |

Default is `hono-rpc` because it provides end-to-end TypeScript inference without code generation
beyond the `AppType` export.

---

## package.json (Generated)

```json
{
  "name": "@dtfs/shared",
  "version": "0.0.1",
  "private": true,
  "exports": {
    ".": "./src/index.ts",
    "./types": "./src/types/index.ts",
    "./schemas": "./src/schemas/index.ts",
    "./errors": "./src/errors.ts"
  },
  "dependencies": {
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "typescript": "^5.x"
  }
}
```

The package uses `"exports"` with direct `.ts` source paths — consumed by workspace packages
that run `tsx` or Next.js (which resolves TypeScript source directly in pnpm workspaces).

---

## Generation Order

```
SharedContract row
  ↓
packages/shared/src/types/<entity>.ts     (one per Entity)
packages/shared/src/schemas/<entity>.ts   (one per Entity)
packages/shared/src/types/auth.ts         (from AuthMethod)
packages/shared/src/types/roles.ts        (from AppRole rows)
packages/shared/src/types/events.ts       (from EventDefinition rows)
packages/shared/src/errors.ts             (from BackendContract.errors)
packages/shared/src/api-contract.ts       (from SharedContract.apiClient)
packages/shared/src/index.ts             (barrel re-export)
packages/shared/package.json
packages/shared/tsconfig.json
  ↓
apps/web/lib/api/<resource>.ts            (per-resource SDK clients)
apps/web/lib/api/index.ts                 (barrel re-export)
```

---

## Related Docs

- `SHARED_CONTRACT.md` — the input to this emitter
- `BACKEND_CONTRACT.md` — source of route table and error catalog
- `HONO_GENERATION.md` — where `AppType` is defined (consumed by SDK client)
- `NEXT16_GENERATION.md` — how the frontend imports and uses the SDK
- `GENERATED_ARTIFACTS.md` — how generated files are tracked
