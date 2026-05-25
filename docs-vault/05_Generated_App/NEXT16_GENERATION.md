# NEXT16_GENERATION

L'emitter Next 16 (`emitNextFrontend`) lit le `FrontendContract` et produit le package `apps/web/` du monorepo généré : pages App Router, composants générés, layouts, SDK client et config Tailwind. Principe directeur : **server-components-first** — chaque composant est RSC par défaut, `"use client"` uniquement si nécessaire.

Liens : [[../04_Runtime_Contracts/FRONTEND_CONTRACT]] · [[SHARED_SDK_GENERATION]] · [[HONO_API_GENERATION]] · [[GENERATED_ARTIFACTS]]

---

## Source of truth

`docs/NEXT16_GENERATION.md` · `backend/src/codegen/emit-next.ts`

---

## Stack cible

| Technologie | Version |
|---|---|
| Next.js | `16.x` (App Router, Turbopack, React Compiler) |
| React | `19.x` |
| Tailwind CSS | `v4.x` (CSS-first config) |
| Zod | `^3.x` via `react-hook-form` + `@hookform/resolvers/zod` |
| Better Auth | latest — `createAuthClient()` depuis `better-auth/react` |

---

## Structure générée

```
apps/web/
  app/
    layout.tsx                   ← root layout RSC
    page.tsx                     ← écran racine "/"
    (auth)/login/page.tsx
    (auth)/register/page.tsx
    <route>/page.tsx             ← une par Screen
    loading.tsx · error.tsx · not-found.tsx
  components/generated/
    <ComponentName>.tsx          ← server|client|form|layout|data
  lib/
    api/index.ts                 ← SDK client typé (hono/client)
    auth/auth-client.ts          ← Better Auth React client
    schemas/index.ts
  tailwind.config.ts
  next.config.ts
  package.json · tsconfig.json
```

---

## Mapping Screen → Page

| `Screen.path` | Fichier Next.js |
|---|---|
| `/` | `app/page.tsx` |
| `/customers` | `app/customers/page.tsx` |
| `/customers/:id` | `app/customers/[id]/page.tsx` |
| `/admin/settings` | `app/admin/settings/page.tsx` |

Les route groups `(group)` sont utilisés pour les screens partageant un layout sans ajouter de segment d'URL.

---

## Kinds de composants et directive `"use client"`

| Kind | Directive | Cas d'usage |
|---|---|---|
| `server` | aucune | RSC — fetch inline, pas de hooks |
| `client` | `"use client"` | APIs browser, hooks React |
| `form` | `"use client"` | Formulaire contrôlé — toujours client |
| `layout` | aucune | Wrapper layout — server par défaut |
| `data` | aucune | Table/liste — fetch server-side |

---

## Pattern de page générée (Next 16 async params)

```tsx
// Generated — app/customers/[id]/page.tsx
type Props = { params: Promise<{ id: string }> };

export default async function CustomerDetailPage({ params }: Props) {
  const { id } = await params;
  const customer = await getCustomer(id);
  if (!customer) notFound();
  return <main><CustomerHeader customer={customer} /></main>;
}
```

`params` est `Promise<...>` — API Next 16 (paramètres asynchrones).

---

## DataBinding → stratégie de fetch

| `DataBindingDescriptor.strategy` | Pattern généré |
|---|---|
| `server-fetch` | `async function Page()` + `await fetch(...)` ou appel repository |
| `client-query` | TanStack Query `useQuery(...)` dans un Client Component |
| `props` | Données passées en props depuis la page parente |

---

## Auth guards

Pages avec `authGuard: "requireSession"` obtiennent une redirection server-side :

```tsx
const session = await auth.api.getSession({ headers: await headers() });
if (!session) redirect("/login");
```

---

## État actuel

`emit-next.ts` génère des **pages stubs** : les `RouteDescriptors` sont consommés mais `forms`, `actions` et `dataBindings` du `FrontendContract` ne sont **pas encore câblés** (AUDIT_REPORT P1). Les pages sont vides de logique métier.

---

## AI usage

Vérifier que `FrontendContract.forms` et `dataBindings` sont peuplés avant de lancer `dtfs__generate_frontend_next`. Pages sans dataBindings = stubs non fonctionnels.

## Status

`documented` — `emitNextFrontend` implémenté dans `emit-next.ts` ; **forms/actions/dataBindings compilés mais non émis** (pages quasi vides — AUDIT_REPORT P1) ; Theme/Translation absents.
