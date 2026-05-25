# Next 16 Generation

> Status: **design doc** — emitter adaptation (`emit-next.ts`) begins in Phase 28.
> References: `FRONTEND_CONTRACT.md`, `RUNTIME_TARGET.md`, `SDK_GENERATION.md`, `GENERATED_ARTIFACTS.md`.

---

## What This Doc Covers

How `FrontendContract` → Next.js 16 App Router TSX/TS source files.

The Next 16 emitter (Phase 28 adaptation of `emit-next.ts`) reads `FrontendContract` rows — not
the Control Plane directly — and produces the `apps/web/` package of the generated monorepo.

---

## Target Stack

| Technology | Version | Notes |
|------------|---------|-------|
| Next.js | `16.x` | App Router, React Server Components, Turbopack, React Compiler |
| React | `19.x` | Concurrent features, Server Components, Server Actions |
| Tailwind CSS | `v4.x` | CSS-first config, `@import "tailwindcss"` |
| Zod | `^3.x` | Form validation via `react-hook-form` + Zod resolver |
| Better Auth | latest | `createAuthClient()` from `better-auth/react` |

---

## Design Principle: Server-Components-First

Every generated component defaults to a React Server Component (RSC) unless it requires:
- Browser APIs (`window`, `document`, event listeners)
- React hooks (`useState`, `useEffect`, `useRef`, etc.)
- Interactivity (click handlers, form state)

Only then is `"use client"` added at the top of the file.

```
FrontendContract.components[].kind
  "server"  → RSC (no "use client")
  "client"  → Client Component (add "use client")
  "form"    → Client Component (always — needs controlled state)
  "layout"  → RSC (layouts are server by default)
  "data"    → RSC (data tables fetched server-side)
```

---

## Generated Output Structure

```
apps/web/
  app/
    layout.tsx                   ← root layout (RSC)
    page.tsx                     ← root screen (path="/")
    (auth)/
      login/
        page.tsx                 ← login screen
      register/
        page.tsx
    customers/
      page.tsx                   ← customer list screen
      [id]/
        page.tsx                 ← customer detail screen
    loading.tsx                  ← Next.js loading UI (Suspense)
    error.tsx                    ← Next.js error boundary ("use client")
    not-found.tsx
  components/
    generated/
      CustomerHeader.tsx
      InvoiceList.tsx
      CreateCustomerForm.tsx
  lib/
    api/                         ← typed SDK client (from SharedContract)
      index.ts
      customers.ts
      invoices.ts
    auth/
      auth-client.ts             ← Better Auth React client
    schemas/                     ← Zod schemas re-exported from shared
      index.ts
  tailwind.config.ts
  next.config.ts
  package.json
  tsconfig.json
```

---

## Screen → Page Mapping

Each `Screen` in `FrontendContract.pages` becomes a Next.js `page.tsx`:

| Screen.path | Next.js route |
|-------------|--------------|
| `/` | `app/page.tsx` |
| `/customers` | `app/customers/page.tsx` |
| `/customers/:id` | `app/customers/[id]/page.tsx` |
| `/admin/settings` | `app/admin/settings/page.tsx` |

Route groups `(group)` are used for screens that share a layout without adding a path segment.

---

## Page Generation Pattern

```tsx
// Generated — app/customers/[id]/page.tsx
import { notFound } from "next/navigation";
import { CustomerHeader } from "@/components/generated/CustomerHeader";
import { InvoiceList } from "@/components/generated/InvoiceList";
import { getCustomer } from "@/lib/api/customers";

type Props = { params: Promise<{ id: string }> };

export default async function CustomerDetailPage({ params }: Props) {
  const { id } = await params;
  const customer = await getCustomer(id);
  if (!customer) notFound();

  return (
    <main>
      <CustomerHeader customer={customer} />
      <InvoiceList customerId={id} />
    </main>
  );
}
```

Key points:
- `params` is typed as `Promise<...>` — Next 16 async params API.
- Page is an `async function` (RSC with `await`).
- Data is fetched in the page; components receive data as props.

---

## Component Generation Pattern

### Server Component

```tsx
// Generated — components/generated/CustomerHeader.tsx
import type { Customer } from "@dtfs/shared";

type Props = { customer: Customer };

export function CustomerHeader({ customer }: Props) {
  return (
    <header>
      <h1>{customer.name}</h1>
      <p>{customer.email}</p>
    </header>
  );
}
```

### Client Component

```tsx
// Generated — components/generated/CustomerActions.tsx
"use client";

import { useState } from "react";
import type { Customer } from "@dtfs/shared";

type Props = { customer: Customer };

export function CustomerActions({ customer }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen(true)}>Edit</button>
      {/* TODO: implement modal */}
    </div>
  );
}
```

---

## Form Generation Pattern

Forms are always Client Components. They use Zod for validation.

```tsx
// Generated — components/generated/CreateCustomerForm.tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { CreateCustomerInputSchema } from "@dtfs/shared/schemas";
import { createCustomer } from "@/lib/api/customers";
import type { z } from "zod";

type FormData = z.infer<typeof CreateCustomerInputSchema>;

export function CreateCustomerForm() {
  const router = useRouter();
  const form = useForm<FormData>({ resolver: zodResolver(CreateCustomerInputSchema) });

  async function onSubmit(data: FormData) {
    await createCustomer(data);
    router.push("/customers");
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <input {...form.register("email")} type="email" placeholder="Email" />
      {form.formState.errors.email && <span>{form.formState.errors.email.message}</span>}
      <input {...form.register("name")} placeholder="Name" />
      <button type="submit">Create</button>
    </form>
  );
}
```

---

## DataBinding → Data Fetching Strategy

| DataBindingDescriptor.strategy | Generated pattern |
|-------------------------------|------------------|
| `server-fetch` | `async function Page()` + `await fetch(...)` or repository call |
| `client-query` | TanStack Query `useQuery(...)` in a Client Component |
| `props` | Data passed as props from parent Page |

For `server-fetch`, Next.js `fetch` with `cache: "no-store"` is used for mutable data, and the default `cache: "force-cache"` for static data.

---

## Auth Guard Generation

Pages marked with `authGuard: "requireSession"` get a server-side redirect:

```tsx
// Generated — app/customers/page.tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth-client";
import { headers } from "next/headers";

export default async function CustomersPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  // ... rest of page
}
```

For role-based guards:

```tsx
  if (!session || session.user.role !== "ADMIN") redirect("/forbidden");
```

---

## Root Layout

```tsx
// Generated — app/layout.tsx
import type { Metadata } from "next";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "My App",
  description: "Generated by dtfs",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

---

## Tailwind v4 Config

```ts
// Generated — tailwind.config.ts (minimal — tokens from Theme)
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.tsx", "./components/**/*.tsx"],
  theme: {
    extend: {
      // TODO: inject Theme tokens from FrontendContract
    },
  },
};

export default config;
```

---

## Related Docs

- `FRONTEND_CONTRACT.md` — the input to this emitter
- `SDK_GENERATION.md` — how the typed API client is generated (used in pages + forms)
- `SHARED_CONTRACT.md` — shared types consumed by components + forms
- `BACKEND_CONTRACT.md` — the backend surface this frontend calls
- `GENERATED_ARTIFACTS.md` — how generated files are tracked
- `CODEGEN.md` — Phase 17 MVP emitter (precursor to this)
