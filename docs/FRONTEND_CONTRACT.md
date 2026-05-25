# FrontendContract

> Status: **design doc** — model does not exist in schema.prisma yet. Added in Phase 25.
> References: `RUNTIME_CONTRACTS_OVERVIEW.md`, `RUNTIME_TARGET.md`, `NEXT16_GENERATION.md`.

---

## What Is a FrontendContract

A `FrontendContract` is the compiled description of everything the Next.js frontend must render:
routes, pages, layouts, components, forms, data-fetching, actions, and auth guards.

It is produced by `compileFrontendContract(projectId)` — a read pass over the Control Plane
(Screen, Component, Form, Field, FieldOption, Action, DataBinding, Policy, Translation, Theme, Asset)
that translates each concept into a framework-agnostic descriptor.

The Next 16 emitter (Phase 28) reads `FrontendContract` rows to generate actual TypeScript/TSX files.
It does NOT read the Control Plane directly.

---

## Model Shape (doc form — not yet in schema.prisma)

```
FrontendContract {
  id              String   — cuid
  projectId       String   — FK Project
  runtimeTargetId String?  — FK RuntimeTarget
  routes          Json     — RouteDescriptor[]
  pages           Json     — PageDescriptor[]
  layouts         Json?    — LayoutDescriptor[]
  components      Json     — ComponentDescriptor[]
  forms           Json     — FormDescriptor[]
  dataBindings    Json     — DataBindingDescriptor[]
  actions         Json     — ActionDescriptor[]
  authGuards      Json?    — AuthGuardDescriptor[]
  generatedFrom   Json?    — provenance: { screens[], components[], forms[], fields[], actions[] }
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
| `runtimeTargetId` | String? | FK to `RuntimeTarget` |
| `routes` | Json | Next.js route path descriptors (path → page mapping) |
| `pages` | Json | Per-page configs: layout, auth-guard requirement, data needs |
| `layouts` | Json? | Shared layout descriptors (root layout, authenticated layout, etc.) |
| `components` | Json | Component stubs with kind: `server`, `client`, `form`, `layout`, `data` |
| `forms` | Json | Form + Zod validation + submit action + API client call + state descriptors |
| `dataBindings` | Json | Fetch / TanStack Query / props-mapping descriptors |
| `actions` | Json | Button / link / form-submit / server-action / API-mutation / navigation descriptors |
| `authGuards` | Json? | Which pages require session / which role |
| `generatedFrom` | Json? | Provenance: which Control Plane IDs contributed |
| `createdAt` / `updatedAt` | DateTime | Standard timestamps |

---

## Control Plane → FrontendContract Mapping

| Control Plane concept | What it becomes in FrontendContract |
|-----------------------|--------------------------------------|
| `Screen` | `app/<route>/page.tsx` — or `app/(group)/<route>/page.tsx` for grouped screens |
| `Component` | `components/generated/<ComponentName>.tsx` with kind: server / client / form / layout / data |
| `Form` | React form component + Zod validation schema + submit action + API client call + error/success state |
| `Field` | `<input>` / `<select>` / `<textarea>` / checkbox / date-picker / asset-upload / hidden / computed |
| `Action` | Button / link / form submit / server action / API mutation / navigation |
| `DataBinding` | Server-side fetch / TanStack Query / props mapping / loading state / empty state / error state |
| `Policy` | Frontend auth guard (hide unauthorized UI actions; redirect unauthenticated users) |
| `Translation` | i18n strings wired to locale via `next-intl` or equivalent |
| `Theme` | Tailwind config tokens injected into `tailwind.config.ts` |
| `Asset` | Next.js `<Image>` component / file rendering / upload component |

---

## RouteDescriptor Shape

```jsonc
{
  "path": "/customers/:id",
  "nextPath": "app/customers/[id]/page.tsx",
  "pageId": "page_customer_detail",
  "authGuard": "requireSession",
  "source": { "kind": "Screen", "id": "scr_xxx" }
}
```

---

## PageDescriptor Shape

```jsonc
{
  "id": "page_customer_detail",
  "title": "Customer Detail",
  "layoutId": "authenticated-layout",
  "authGuard": "requireSession",
  "dataNeeds": [
    { "bindingId": "bind_customer_by_id", "suspense": true }
  ],
  "components": ["comp_customer_header", "comp_invoice_list"],
  "source": { "kind": "Screen", "id": "scr_xxx" }
}
```

---

## ComponentDescriptor Shape

```jsonc
{
  "id": "comp_customer_header",
  "name": "CustomerHeader",
  "kind": "server" | "client" | "form" | "layout" | "data",
  "props": [{ "name": "customer", "type": "Customer" }],
  "children": [],
  "source": { "kind": "Component", "id": "cmp_xxx" }
}
```

Component kinds:
- `server` — React Server Component; fetches data inline, no `"use client"`
- `client` — needs browser APIs or interactivity; top boundary marked `"use client"`
- `form` — controlled form with submit action
- `layout` — wrapping layout (header, sidebar, footer)
- `data` — data-display table / list / card deck

---

## FormDescriptor Shape

```jsonc
{
  "id": "form_create_customer",
  "name": "CreateCustomerForm",
  "operationId": "op_createCustomer",
  "fields": [
    { "name": "email", "type": "EMAIL", "required": true, "zodRule": "z.string().email()" },
    { "name": "name",  "type": "TEXT",  "required": true, "zodRule": "z.string().min(1)" }
  ],
  "submitAction": { "kind": "api-mutation", "endpoint": "POST /api/operations/createCustomer" },
  "successRedirect": "/customers",
  "source": { "kind": "Form", "id": "frm_xxx" }
}
```

---

## DataBindingDescriptor Shape

```jsonc
{
  "id": "bind_customer_by_id",
  "strategy": "server-fetch" | "client-query" | "props",
  "endpoint": "GET /api/customers/:id",
  "params": { "id": "route.params.id" },
  "resultSchema": "CustomerResponse",
  "loadingState": "skeleton",
  "emptyState": "not-found-redirect",
  "source": { "kind": "DataBinding", "id": "db_xxx" }
}
```

---

## AuthGuardDescriptor Shape

```jsonc
[
  {
    "pageId": "page_customer_detail",
    "require": "session",
    "redirectTo": "/login",
    "role": null
  },
  {
    "pageId": "page_admin_panel",
    "require": "role",
    "role": "ADMIN",
    "redirectTo": "/forbidden"
  }
]
```

---

## Compilation Steps

`compileFrontendContract(projectId)` runs in this order:

1. Load `RuntimeTarget` for the project.
2. Load all Control Plane frontend concepts: Screen, Component, Form, Field, FieldOption, Action, DataBinding.
3. Load Policy rows that affect UI (hide actions, auth guards).
4. Load Translation rows (for i18n descriptors).
5. Load Theme row (for Tailwind token descriptors).
6. For each Screen → emit `RouteDescriptor` + `PageDescriptor`.
7. For each Component → emit `ComponentDescriptor` (resolve kind from Component.type).
8. For each Form → emit `FormDescriptor` (resolve fields, Zod rules, submit action).
9. For each DataBinding → emit `DataBindingDescriptor`.
10. For each Action → emit `ActionDescriptor`.
11. For each Policy (UI-scope) → emit `AuthGuardDescriptor` for affected pages.
12. Write `FrontendContract` row to DB.

---

## Related Docs

- `RUNTIME_TARGET.md` — the RuntimeTarget that parameterizes this contract
- `RUNTIME_CONTRACTS_OVERVIEW.md` — the overall architecture
- `BACKEND_CONTRACT.md` — the backend surface this frontend consumes
- `SHARED_CONTRACT.md` — shared types the frontend imports
- `NEXT16_GENERATION.md` — how FrontendContract → Next 16 TSX files
- `SDK_GENERATION.md` — the typed API client the frontend uses
- `GENERATED_ARTIFACTS.md` — how generated files are tracked
