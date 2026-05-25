# CLIENT_APP_RUNTIME

L'app cliente générée est le produit final de DTFS — une application full-stack autonome, déployable indépendamment, avec sa propre base de données et son propre runtime. Elle est entièrement dérivée du Control Plane et peut être régénérée à tout moment depuis le même état.

Liens : [[ARCHITECTURE_OVERVIEW]] · [[CONTROL_PLANE]] · [[SEPARATION_OF_CONCERNS]] · [[DATA_OWNERSHIP]] · [[EXECUTION_FLOW]]

---

## Structure de l'app générée

```
generated-app/
  apps/
    api/                      ← Hono 4 backend
      src/
        index.ts              ← point d'entrée Hono
        auth.ts               ← Better Auth handler (/api/auth/*)
        routes/               ← CRUD + endpoints nommés (depuis BackendContract.routes)
        operations/           ← handlers d'opérations (Operation kind=COMMAND/QUERY)
        policies/             ← middlewares de policy (depuis BackendContract.middlewares)
        repositories/         ← accès DB par entité
        middleware/           ← session, auth guard, error handler
        assets/               ← upload/download endpoints (Asset — P1, non encore émis)
        events/               ← payloads d'événements typés (EventDefinition — P1)
    web/                      ← Next 16 App Router frontend
      app/                    ← routes (depuis FrontendContract.routes)
      components/generated/   ← composants générés (depuis FrontendContract.components)
      lib/
        api/                  ← SDK typé (depuis SharedContract.apiClient)
        auth/                 ← hooks session côté client
        schemas/              ← Zod schemas partagés
  packages/
    shared/                   ← types + Zod + SDK client (depuis SharedContract)
      src/
        schemas/
        types/
        errors.ts
        api-contract.ts
  prisma/
    schema.prisma             ← depuis BackendContract.schemas (Entity → table Prisma)
    migrations/
  tests/
    api/                      ← tests d'intégration API
    e2e/                      ← tests end-to-end
    contract/                 ← tests de contrat
  docker-compose.yml          ← PostgreSQL + app (cible, non encore émis)
```

---

## Sa propre base de données

L'app cliente a **sa propre base PostgreSQL**, distincte de la base du Control Plane.

**Contenu de la base cliente** :

| Table | Source |
|---|---|
| `user` | Better Auth (généré par `emit-auth.ts`) |
| `session` | Better Auth |
| `account` | Better Auth |
| Tables métier | Dérivées des `Entity` du Control Plane via `BackendContract.schemas` |
| Assets metadata | `Asset` → table de stockage des fichiers (P1, non encore émis) |

La base cliente ne contient **aucune** table du Control Plane (`ChangeSet`, `Revision`, `ProductSpec`, etc.).

---

## Stack cible

| Composant | Technologie | Version cible |
|---|---|---|
| Backend API | Hono | `~4.12.x` |
| Auth | Better Auth | latest stable |
| ORM | Prisma | `7.x` |
| DB | PostgreSQL | 14+ |
| Frontend | Next.js | `16.x` App Router |
| Shared types | Zod | `^3.x` |
| Package manager | pnpm | `10.x` |

---

## Ordre de génération recommandé

1. `prisma/schema.prisma` (schéma DB)
2. `packages/shared/` (types + Zod schemas)
3. `apps/api/src/auth.ts` (Better Auth runtime)
4. `apps/api/src/routes/` (API Hono)
5. `apps/web/` (frontend Next 16)
6. `apps/web/lib/api/` (SDK client typé)
7. `tests/` (scénarios de test)

---

## Chaque fichier est tracé

Chaque fichier émis est enregistré comme un `GeneratedArtifact` dans le Control Plane avec :
- `path` : chemin relatif dans `generated-app/`
- `contentHash` : hash du contenu pour détecter les modifications manuelles
- `protected` : flag pour protéger les fichiers modifiés manuellement (P0 — actuellement codé en dur à `false`)
- Lien vers le `BackendContract` / `FrontendContract` / `SharedContract` source

---

## État d'implémentation

| Composant | État |
|---|---|
| `emit-prisma.ts` → `prisma/schema.prisma` | Partiellement implémenté (lit le spec brut, pas le contrat — P1) |
| `emit-hono.ts` → `apps/api/src/routes/` | Partiellement implémenté (policy middlewares = stubs pass-through — P1) |
| `emit-auth.ts` → `apps/api/src/auth.ts` | Partiellement implémenté (config stub, handler `/api/auth/*` manquant — P1) |
| `emit-next.ts` → `apps/web/app/` | Partiellement implémenté (forms/actions/dataBindings compilés mais non consommés — P1) |
| `emit-sdk.ts` → `packages/shared/` | Partiellement implémenté (SDK généré mais non importé dans les pages — P2) |
| `emit-asset.ts` | Absent — P1 |
| `docker-compose.yml` | Absent — cible |

Le Docker runtime client n'existe pas encore. C'est une cible de la roadmap (Phase V3+).

---

## Source of truth

`docs/RUNTIME_CONTRACTS_OVERVIEW.md` · `docs/CODEGEN.md` · `backend/src/codegen/emit-hono.ts` · `backend/src/codegen/emit-next.ts` · `backend/src/codegen/emit-auth.ts` · `backend/src/codegen/emit-prisma.ts`

## AI usage

Un agent ne doit jamais écrire directement dans `generated-app/` sans passer par le pipeline codegen. Tout fichier écrit manuellement dans `generated-app/` risque d'être écrasé lors de la prochaine génération (tant que `protected` n'est pas fonctionnel).

## Status

partially implemented
