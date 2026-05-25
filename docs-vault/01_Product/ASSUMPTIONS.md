# ASSUMPTIONS

Hypothèses fondatrices de DTFS — décisions prises par défaut, non encore remises en question. Chaque hypothèse a un risque identifié si elle s'avère fausse.

Liens : [[OPEN_QUESTIONS]] · [[REQUIREMENTS]] · [[PRODUCT_VISION]] · [[ARCHITECTURE_OVERVIEW]]

---

## Format

> **Hypothèse** : ce qui est tenu pour vrai sans validation externe.
> **Risque si fausse** : ce qui doit être retravaillé.
> **Dépendances** : fichiers ou décisions qui reposent dessus.

---

## ASS-01 — PostgreSQL par défaut

**Hypothèse** : la base de données cible (Control Plane et app générée) est PostgreSQL (14+), accessible via `@prisma/adapter-pg`. Aucune URL n'est codée dans le schéma Prisma — la connexion est fournie à l'exécution.

**Risque si fausse** : si un client veut MySQL ou SQLite, l'adaptateur Prisma change, les migrations sont incompatibles, les types JSON et les UUIDs peuvent se comporter différemment.

**Dépendances** : `backend/prisma/schema.prisma` (datasource block) · `backend/prisma.config.ts` · `CLAUDE.md`

---

## ASS-02 — pnpm 10 + workspace protocol

**Hypothèse** : le gestionnaire de paquets est pnpm 10. Les dépendances inter-workspaces utilisent `workspace:*`. La configuration des workspaces est dans `pnpm-workspace.yaml`, pas dans `package.json#workspaces`.

**Risque si fausse** : un passage à npm ou yarn invalide les scripts `--filter`, les hoisting rules et les liens symboliques entre workspaces.

**Dépendances** : `pnpm-workspace.yaml` · `package.json` de chaque workspace · `CLAUDE.md`

---

## ASS-03 — Next.js 16 App Router (frontend cible)

**Hypothèse** : le frontend des apps générées cible Next.js 16 avec l'App Router, les Server Components, Turbopack et React Compiler. Pas de Pages Router.

**Risque si fausse** : `emit-next.ts` génère des fichiers incompatibles avec Next 14 ou avec le Pages Router. Les patterns de layout, loading, error sont spécifiques à l'App Router.

**Dépendances** : `backend/src/codegen/emit-next.ts` · `docs/NEXT16_GENERATION.md` · `docs/RUNTIME_CONTRACTS_OVERVIEW.md`

---

## ASS-04 — Better Auth pour l'authentification

**Hypothèse** : l'authentification des apps générées est gérée par Better Auth (handler sur `/api/auth/*`, tables `user`/`session`/`account` dans la DB cliente, framework-agnostic).

**Risque si fausse** : si Clerk ou Auth.js est préféré, `emit-auth.ts` est à réécrire entièrement. Les tables Better Auth dans la DB cliente doivent être remplacées.

**Dépendances** : `backend/src/codegen/emit-auth.ts` · `docs/BETTER_AUTH_GENERATION.md` · `docs/RUNTIME_CONTRACTS_OVERVIEW.md`

---

## ASS-05 — Node runtime pour le Control Plane

**Hypothèse** : le Control Plane tourne sur Node.js via `tsx` (pas Bun, pas Deno). Les scripts utilisent `tsx --env-file=../.env`.

**Risque si fausse** : voir [[OPEN_QUESTIONS]] OQ-03 (Bun). Un changement de runtime impose de revalider tous les imports ESM, les adaptateurs natifs (pg, prisma) et les scripts de migration.

**Dépendances** : `backend/package.json` · `CLAUDE.md` · scripts `pnpm dev:backend`

---

## ASS-06 — Hono 4 pour l'API backend générée

**Hypothèse** : le backend des apps générées est une API Hono 4 (`~4.12.x`) utilisant les Web Standards API, avec `@hono/node-server` pour Node.

**Risque si fausse** : `emit-hono.ts` et `BackendContract.routes` sont spécifiques à la syntaxe Hono. Un passage à Fastify ou Express invalide tous les emitters backend.

**Dépendances** : `backend/src/codegen/emit-hono.ts` · `docs/HONO_GENERATION.md` · `docs/RUNTIME_CONTRACTS_OVERVIEW.md`

---

## ASS-07 — Prisma 7 + adaptateur pg (no url in datasource)

**Hypothèse** : Prisma 7 est utilisé avec `@prisma/adapter-pg`. Il n'y a **pas** de champ `url` dans le bloc `datasource` du schéma Prisma — la connexion est injectée au runtime.

**Risque si fausse** : Prisma 6 et antérieurs utilisent `url = env("DATABASE_URL")`. Un downgrade casse la configuration de connexion. Un upgrade Prisma 8 peut changer l'API de l'adaptateur.

**Dépendances** : `backend/prisma/schema.prisma` · `backend/src/db.ts` · `CLAUDE.md`

---

## ASS-08 — Biome 2.4 comme linter/formatter

**Hypothèse** : Biome 2.4 est l'unique outil de lint et format (pas ESLint, pas Prettier). Configuration : indentation par tabulation, guillemets doubles, organize-imports on save.

**Risque si fausse** : un changement de formatter crée des diffs de style massifs dans tout le codebase et invalide les scripts `pnpm lint` / `pnpm format`.

**Dépendances** : `biome.json` · `CLAUDE.md`

---

## Source of truth

`CLAUDE.md` · `backend/prisma/schema.prisma` · `docs/RUNTIME_CONTRACTS_OVERVIEW.md`

## AI usage

Avant de proposer un changement de stack (ex. : "utilisons Bun"), un agent doit référencer l'hypothèse concernée et évaluer le risque. Il ne doit pas modifier la stack sans décision explicite.

## Status

documented
