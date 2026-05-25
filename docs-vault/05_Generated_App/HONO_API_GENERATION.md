# HONO_API_GENERATION

L'emitter Hono (`emitHonoBackendApi`) lit le `BackendContract` et produit le package `apps/api/` du monorepo généré : entry point, routes CRUD, handlers d'opération, policies, repositories, middlewares, assets et events. L'export `AppType` de `apps/api/src/index.ts` est la surface de type consommée par le SDK frontend.

Liens : [[../04_Runtime_Contracts/BACKEND_CONTRACT]] · [[BETTER_AUTH_GENERATION]] · [[SHARED_SDK_GENERATION]] · [[GENERATED_ARTIFACTS]]

---

## Source of truth

`docs/HONO_GENERATION.md` · `backend/src/codegen/emit-hono.ts`

---

## Stack cible

| Technologie | Version |
|---|---|
| Hono | `~4.12.x` (Web Standards API) |
| `@hono/node-server` | matching Hono |
| `@hono/zod-validator` | validation entrée |
| Zod | `^3.x` |
| Prisma | `7.x` + `@prisma/adapter-pg` |
| Better Auth | latest stable |

---

## Structure générée

```
apps/api/src/
  index.ts             ← Hono app entry + AppType export
  auth.ts              ← Better Auth handler (→ BETTER_AUTH_GENERATION)
  routes/
    <resource>.ts      ← une par Resource (famille CRUD)
  operations/
    <operation>.ts     ← une par Operation
    index.ts
  policies/
    <policy>.ts        ← une par Policy (middleware factory)
    index.ts
  repositories/
    <entity>.ts        ← helpers Prisma CRUD
    index.ts
  middleware/
    session.ts
    require-session.ts
    require-role.ts
  assets/
    routes.ts          ← upload + serve (cible — non émis actuellement)
  events/
    emitter.ts         ← stubs emitter typés
```

---

## Mapping RouteDescriptor.kind → artifact

| kind | Artifact généré | Pattern |
|---|---|---|
| `resource` (list) | `routes/<r>.ts` GET `/` | `findMany` |
| `resource` (getById) | `routes/<r>.ts` GET `/:id` | `findUnique` |
| `resource` (create) | `routes/<r>.ts` POST `/` | `create` |
| `resource` (update) | `routes/<r>.ts` PATCH `/:id` | `update` |
| `resource` (delete) | `routes/<r>.ts` DELETE `/:id` | `delete` |
| `operation` | `operations/<name>.ts` POST | stub handler (corps TODO) |
| `auth` | monté dans `index.ts` via Better Auth | handler `/api/auth/**` |
| `asset` | `assets/routes.ts` | upload + serve (cible) |

---

## Pattern index.ts

```ts
// Generated — apps/api/src/index.ts
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { handle } from "better-auth/node";
import { auth } from "./auth";

const app = new Hono();
app.on(["GET", "POST"], "/api/auth/**", (c) => handle(auth)(c.req.raw));
// routes montées ici…
app.get("/health", (c) => c.json({ ok: true }));
serve({ fetch: app.fetch, port: 4000 });
export type AppType = typeof app;
```

`AppType` est le contrat de type Hono consommé par `hc<AppType>(...)` dans le SDK frontend.

---

## État des guards de policy

Les middlewares de policy sont générés comme **stubs pass-through** (corps `TODO`). La compilation réelle de `PolicyRule` → middleware est prévue en Phase 28+ (AUDIT_REPORT P1).

---

## Ordre de génération interne

1. `prisma/schema.prisma` (database layer)
2. `src/auth.ts` (auth layer)
3. `src/middleware/`
4. `src/policies/`
5. `src/repositories/`
6. `src/routes/`
7. `src/operations/`
8. `src/assets/routes.ts`
9. `src/events/emitter.ts`
10. `src/index.ts`

---

## AI usage

Lire [[../04_Runtime_Contracts/BACKEND_CONTRACT]] pour comprendre la structure d'entrée. L'emitter ne doit jamais accéder à la DB directement — il reçoit un `BackendContractObj` en paramètre.

## Status

`documented` — `emitHonoBackendApi` implémenté dans `emit-hono.ts` ; guards = stubs pass-through ; assets non émis (AUDIT_REPORT P1).
