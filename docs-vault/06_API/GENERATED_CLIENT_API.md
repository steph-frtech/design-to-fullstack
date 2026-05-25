# GENERATED_CLIENT_API

The generated app's API is derived entirely from `BackendContract`. It is NOT the Control Plane API.
DTFS codegen emits a Hono backend (`apps/api/`) whose routes are determined by the project's Resource, Operation, AuthMethod, and Asset concepts compiled into a `BackendContract`.

[[OPENAPI_GUIDELINES]] · [[CONTROL_PLANE_API]] · [[04_Runtime_Contracts/]] · [[openapi/generated-client-api.openapi.yaml]]

## Source of truth

`docs/BACKEND_CONTRACT.md` — the BackendContract model and RouteDescriptor shapes. `docs/HONO_GENERATION.md` — how route descriptors become Hono TypeScript files. `docs/BETTER_AUTH_GENERATION.md` — how `auth` descriptors become the Better Auth runtime.

## AI usage

The generated API surface is project-specific. These paths are placeholders that document the *shape* of what codegen produces. Use `dtfs__compile_backend_contract` to get the actual routes for a given project, then `dtfs__generate_app` to emit the code.

## Status

Design doc — paths are illustrative. The actual routes are determined at compile time per project.

---

## Route families produced by BackendContract

### /api/auth/* — Better Auth

Mounted by `auth.on()` in the generated `apps/api/src/index.ts`. The exact sub-routes depend on the `AuthMethod` configured in the project.

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/auth/sign-in/email` | Email + password sign-in |
| POST | `/api/auth/sign-up/email` | Registration |
| POST | `/api/auth/sign-out` | Invalidate session |
| GET | `/api/auth/session` | Current session |
| POST | `/api/auth/forgot-password` | Password reset request |
| POST | `/api/auth/reset-password` | Password reset confirm |

All Better Auth routes are handled by the library; DTFS codegen only provides the config fragment.

### /api/{resource} — CRUD resource routes

One family per `Resource` concept in the Control Plane. Routes are filtered by `Resource.exposedOps`.

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/{resource}` | List (paginated) |
| GET | `/api/{resource}/:id` | Get by id |
| POST | `/api/{resource}` | Create |
| PATCH | `/api/{resource}/:id` | Update |
| DELETE | `/api/{resource}/:id` | Delete |

Example: a `customers` resource → `GET /api/customers`, `GET /api/customers/:id`, etc.

### /api/operations/{name} — Explicit operations

One POST route per `Operation` concept.

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/operations/{name}` | Execute named operation |

Input schema and output schema are defined by the Operation's `inputSchema` / `outputSchema`.

### /api/assets — Asset upload and retrieval

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/assets` | Upload asset (multipart) |
| GET | `/api/assets/:id` | Asset metadata |
| GET | `/api/assets/:id/raw` | Raw asset bytes |

### /health — Healthcheck

| Method | Path | Notes |
|--------|------|-------|
| GET | `/health` | `{ ok: true, uptime: number }` |

---

## TypeScript client

The frontend uses `hono/client` for type-safe RPC — the `AppType` exported from `apps/api/src/index.ts` is the contract. No code generation is needed; imports from `hono/client` provide full type safety.

For external consumers (mobile, third-party), use the `generated-client-api.openapi.yaml` to generate a client with `openapi-ts` or equivalent.

---

See `openapi/generated-client-api.openapi.yaml` for the machine-readable version.
