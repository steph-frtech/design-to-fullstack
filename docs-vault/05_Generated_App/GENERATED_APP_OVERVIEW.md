# GENERATED_APP_OVERVIEW

L'application générée est un monorepo autonome émis dans un répertoire sandboxé (`/tmp/dtfs-codegen-<projectId>/` par défaut). Elle contient `apps/api` (Hono), `apps/web` (Next.js 16), `packages/shared` (types + SDK), `prisma/`, `tests/` et un `docker-compose.yml` cible. Elle a sa **propre base de données** (schéma `gen_<slug>`) — strictement séparée de la Control Plane DB.

Liens : [[../04_Runtime_Contracts/CONTRACT_TO_CODEGEN_MAPPING]] · [[HONO_API_GENERATION]] · [[NEXT16_GENERATION]] · [[SHARED_SDK_GENERATION]] · [[GENERATED_ARTIFACTS]] · [[CLIENT_APP_DOCKER_RUNTIME]]

---

## Source of truth

`docs/RUNTIME_CONTRACTS_OVERVIEW.md` § 6 · `docs/CODEGEN.md` · `backend/src/codegen/codegen.ts`

---

## Arborescence cible complète

```
<outDir>/
  .dtfs-manifest.json                  ← manifest de tracking
  prisma/
    schema.prisma                      ← modèles Better Auth + entités métier
    migrations/
  apps/
    api/
      src/
        index.ts                       ← Hono app + AppType export
        auth.ts                        ← Better Auth config
        routes/
          <resource>.ts                ← une par Resource
        operations/
          <operation>.ts               ← une par Operation
          index.ts
        policies/
          <policy>.ts
          index.ts
        repositories/
          <entity>.ts
          index.ts
        middleware/
          session.ts
          require-session.ts
          require-role.ts
        assets/
          routes.ts                    ← upload + serve (cible)
        events/
          emitter.ts                   ← stubs emitter typés
      package.json
      tsconfig.json
    web/
      app/
        layout.tsx                     ← root layout RSC
        page.tsx                       ← écran racine
        (auth)/
          login/page.tsx
          register/page.tsx
        <route>/
          page.tsx                     ← une par Screen
        loading.tsx
        error.tsx
        not-found.tsx
      components/
        generated/
          <ComponentName>.tsx
      lib/
        api/
          index.ts                     ← SDK client typé
          <resource>.ts
        auth/
          auth-client.ts
        schemas/
          index.ts
      tailwind.config.ts
      next.config.ts
      package.json
      tsconfig.json
  packages/
    shared/
      src/
        types/
          index.ts
          <entity>.ts
          auth.ts
          roles.ts
          events.ts
        schemas/
          index.ts
          <entity>.ts
        errors.ts
        api-contract.ts
        sdk/
          client.ts
          index.ts
        index.ts
      package.json
      tsconfig.json
  tests/
    api/
      <resource>.test.ts
      operations/<name>.test.ts
    contract/
      shared-types.test.ts
    e2e/
      smoke.test.ts
  docker-compose.yml                   ← cible (non émis actuellement)
```

---

## Sandbox et sécurité

`resolveSafeOutDir` impose :
- Chemin absolu obligatoire.
- Pas de traversal `..`.
- Interdit sous `/data/dev/design-to-fullstack/` (jamais écrire dans le meta-platform).
- Autorisé uniquement dans `/tmp/...` ou `<projectLocalPath>/generated/...`.

---

## État d'implémentation

| Couche | État |
|---|---|
| `prisma/schema.prisma` | émis (entities + Better Auth tables) |
| `apps/api/src/auth.ts` | config stub émise |
| `apps/api/src/routes/` | routes émises (guards = stubs pass-through) |
| `apps/api/src/operations/` | handlers stubs (corps TODO) |
| `apps/api/src/middleware/` | session + role émis |
| `apps/api/src/policies/` | stubs pass-through |
| `apps/api/src/assets/` | non émis (cible — AUDIT_REPORT P1) |
| `apps/web/app/` | pages stubs (forms/actions non câblés) |
| `packages/shared/` | types + schemas + errors émis |
| `packages/shared/src/sdk/` | émis |
| `tests/` | stubs only (toujours skipped) |
| `docker-compose.yml` | non émis (cible) |

---

## AI usage

Utiliser `dtfs__generate_app` (dryRun=true par défaut) pour prévisualiser sans écrire. Vérifier la structure avec `dtfs__check_generated_project`. L'app générée est un **point de départ tracé**, pas une app de production prête à l'emploi.

## Status

`documented` — emitters présents ; beaucoup de stubs ; docker-compose et assets non implémentés.
