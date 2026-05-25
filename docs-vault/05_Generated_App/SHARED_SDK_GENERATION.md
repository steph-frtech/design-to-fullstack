# SHARED_SDK_GENERATION

Les emitters `emitSharedPackage` et `emitSdk` lisent le `SharedContract` et produisent `packages/shared/` — l'unique package importé à la fois par `apps/api/` et `apps/web/`. Il contient les types TypeScript, schémas Zod, catalogue d'erreurs, contrat API et le client SDK typé via `hono/client`.

Liens : [[../04_Runtime_Contracts/SHARED_CONTRACT]] · [[HONO_API_GENERATION]] · [[NEXT16_GENERATION]] · [[GENERATED_ARTIFACTS]]

---

## Source of truth

`docs/SDK_GENERATION.md` · `backend/src/codegen/emit-shared.ts` · `backend/src/codegen/emit-sdk.ts`

---

## Pourquoi un package partagé

Sans package partagé, les types et schémas existent en double (backend pour la validation serveur, frontend pour la validation de formulaire). La dérive entre les deux provoque des erreurs runtime. `packages/shared/` est la source unique de vérité.

---

## Structure générée

```
packages/shared/
  src/
    types/
      <entity>.ts          ← Customer, CustomerInput, CustomerResponse
      auth.ts              ← AuthSession, AuthUser
      roles.ts             ← AppRoleKey union
      events.ts            ← payloads d'événements typés
      index.ts             ← barrel
    schemas/
      <entity>.ts          ← CustomerSchema, CustomerInputSchema, CustomerUpdateSchema
      index.ts
    errors.ts              ← ErrorCode enum + ApiError<Code>
    api-contract.ts        ← signatures de fonctions API (typed SDK)
    sdk/
      client.ts            ← client typé via hono/client + AppType
      index.ts
    index.ts               ← API publique
  package.json             ← name: "@dtfs/shared", exports map
  tsconfig.json
```

---

## Pattern types/<entity>.ts

```ts
export interface Customer        { id: string; email: string; name: string; createdAt: Date; }
export interface CustomerInput   { email: string; name: string; }
export interface CustomerResponse { id: string; email: string; name: string; createdAt: string; }
export type CustomerListResponse = CustomerResponse[];
```

---

## Pattern schemas/<entity>.ts

```ts
import { z } from "zod";

export const CustomerSchema = z.object({
  id: z.string(), email: z.string().email(), name: z.string().min(1),
});
export const CustomerInputSchema  = z.object({ email: z.string().email(), name: z.string().min(1) });
export const CustomerUpdateSchema = CustomerInputSchema.partial();

export type CustomerInput  = z.infer<typeof CustomerInputSchema>;
export type CustomerUpdate = z.infer<typeof CustomerUpdateSchema>;
```

---

## Pattern errors.ts

```ts
export type ErrorCode = "NOT_FOUND" | "FORBIDDEN" | "UNAUTHORIZED" | "VALIDATION" | "CONFLICT" | "SERVER_ERROR";

export interface ApiError<Code extends ErrorCode = ErrorCode> { error: Code; }
export interface ValidationApiError extends ApiError<"VALIDATION"> {
  issues: Array<{ path: string[]; message: string }>;
}
```

---

## Pattern api-contract.ts

```ts
export type ApiContract = {
  "GET /api/customers":        () => Promise<CustomerListResponse>;
  "GET /api/customers/:id":    (id: string) => Promise<CustomerResponse | null>;
  "POST /api/customers":       (data: CustomerInput) => Promise<CustomerResponse>;
  "PATCH /api/customers/:id":  (id: string, data: CustomerUpdate) => Promise<CustomerResponse | null>;
  "DELETE /api/customers/:id": (id: string) => Promise<{ ok: boolean }>;
};
```

---

## SDK client (hono/client vs rest-fetch)

| Style | `RuntimeTarget.config.sdkStyle` | Description |
|---|---|---|
| `hono-rpc` (défaut) | `"hono-rpc"` | `hc<AppType>(...)` — inférence de type bout en bout |
| `rest-fetch` | `"rest-fetch"` | `fetch` plain avec typage manuel depuis `ApiContract` |

```ts
// apps/web/lib/api/index.ts (hono-rpc)
import { hc } from "hono/client";
import type { AppType } from "../../api/src/index";

const client = hc<AppType>(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000");
```

---

## Ordre de génération

```
SharedContract
  → packages/shared/src/types/<entity>.ts   (une par Entity)
  → packages/shared/src/schemas/<entity>.ts
  → packages/shared/src/types/auth.ts       (depuis AuthMethod)
  → packages/shared/src/types/roles.ts      (depuis AppRole)
  → packages/shared/src/types/events.ts     (depuis EventDefinition)
  → packages/shared/src/errors.ts
  → packages/shared/src/api-contract.ts
  → packages/shared/src/index.ts
  → packages/shared/package.json · tsconfig.json
  → apps/web/lib/api/<resource>.ts          (SDK client par resource)
```

---

## AI usage

`packages/shared/` doit être généré avant `apps/api/` et `apps/web/` (ils l'importent). Ne pas dupliquer des types dans les autres packages — toujours importer depuis `@dtfs/shared`.

## Status

`documented` — `emitSharedPackage` et `emitSdk` implémentés ; types/schemas/errors émis correctement.
