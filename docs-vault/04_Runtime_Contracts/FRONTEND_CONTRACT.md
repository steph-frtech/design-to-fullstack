# FRONTEND_CONTRACT

Le `FrontendContract` est la représentation compilée et persistée de tout ce que le frontend Next.js doit rendre : routes, pages, layouts, composants, formulaires, data-bindings, actions et auth guards. Il est produit par `compileFrontendContract(projectId)` depuis les concepts Control Plane (Screen, Component, Form, Field, Action, DataBinding, Policy, Translation, Theme, Asset). L'emitter Next 16 lit ce contrat — jamais le Control Plane directement.

Liens : [[RUNTIME_TARGET]] · [[BACKEND_CONTRACT]] · [[SHARED_CONTRACT]] · [[CONTRACT_COMPILATION]] · [[../05_Generated_App/NEXT16_GENERATION]] · [[../05_Generated_App/SHARED_SDK_GENERATION]]

---

## Source of truth

`docs/FRONTEND_CONTRACT.md` · `backend/src/lib/contracts/compile-frontend.ts` · `backend/prisma/schema.prisma` (modèle `FrontendContract`, Phase 25)

---

## Shape du modèle

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
  generatedFrom   Json?    — provenance { screens[], components[], forms[], fields[], actions[] }
  createdAt       DateTime
  updatedAt       DateTime
}
```

---

## Mapping Control Plane → FrontendContract

| Concept Control Plane | Ce que ça devient dans FrontendContract |
|---|---|
| `Screen` | `app/<route>/page.tsx` (ou `app/(group)/<route>/page.tsx`) |
| `Component` | `components/generated/<ComponentName>.tsx` avec kind: server / client / form / layout / data |
| `Form` | Composant React form + schéma Zod + action submit + appel API client + state error/success |
| `Field` | `<input>` / `<select>` / `<textarea>` / checkbox / date picker / asset upload / hidden / computed |
| `Action` | Bouton / lien / form submit / server action / mutation API / navigation |
| `DataBinding` | Fetch server-side / TanStack Query client / props mapping + loading/empty/error state |
| `Policy` | Auth guard frontend (masquer les actions non autorisées, rediriger les non-authentifiés) |
| `Translation` | Strings i18n câblées à la locale via `next-intl` |
| `Theme` | Tokens Tailwind injectés dans `tailwind.config.ts` |
| `Asset` | Composant Next.js `<Image>` / rendu fichier / composant upload |

---

## Shape des sous-types clés

### RouteDescriptor

```jsonc
{
  "path": "/customers/:id",
  "nextPath": "app/customers/[id]/page.tsx",
  "pageId": "page_customer_detail",
  "authGuard": "requireSession",
  "source": { "kind": "Screen", "id": "scr_xxx" }
}
```

### PageDescriptor

```jsonc
{
  "id": "page_customer_detail",
  "title": "Customer Detail",
  "layoutId": "authenticated-layout",
  "authGuard": "requireSession",
  "dataNeeds": [{ "bindingId": "bind_customer_by_id", "suspense": true }],
  "components": ["comp_customer_header", "comp_invoice_list"],
  "source": { "kind": "Screen", "id": "scr_xxx" }
}
```

### ComponentDescriptor — kinds

| Kind | Description |
|---|---|
| `server` | React Server Component — pas de `"use client"` |
| `client` | Client Component — `"use client"` en tête |
| `form` | Formulaire contrôlé avec state submit |
| `layout` | Wrapper layout (header, sidebar, footer) |
| `data` | Table/liste/card deck — fetch côté serveur |

### FormDescriptor

```jsonc
{
  "id": "form_create_customer",
  "operationId": "op_createCustomer",
  "fields": [
    { "name": "email", "type": "EMAIL", "required": true, "zodRule": "z.string().email()" }
  ],
  "submitAction": { "kind": "api-mutation", "endpoint": "POST /api/operations/createCustomer" },
  "successRedirect": "/customers"
}
```

### DataBindingDescriptor

```jsonc
{
  "id": "bind_customer_by_id",
  "strategy": "server-fetch",   // "server-fetch"|"client-query"|"props"
  "endpoint": "GET /api/customers/:id",
  "params": { "id": "route.params.id" },
  "resultSchema": "CustomerResponse",
  "loadingState": "skeleton",
  "emptyState": "not-found-redirect"
}
```

---

## AI usage

Lire ce contrat avant d'invoquer l'emitter Next 16. Vérifier que `forms`, `actions` et `dataBindings` sont bien peuplés avant de générer les pages — si vides, les pages seront des stubs (cf. AUDIT_REPORT P1).

## Status

`documented` — `compileFrontendContract` implémenté ; forms/actions/dataBindings **compilés mais non émis** par `emit-next.ts` (pages quasi vides — AUDIT_REPORT P1) ; Theme/Translation absents.
