# ADR-0005 — Hono 4 pour l'API des applications générées

Les applications générées par DTFS utilisent Hono 4 comme framework HTTP backend, à la fois pour le Control Plane et pour les routes générées.

Liens : [[ADR-0004-separate-control-plane-and-client-runtime]] · [[../05_Generated_App/HONO_GENERATION]].

## Source of truth

`backend/src/codegen/emit-hono.ts` · `backend/src/server.ts`.

## AI usage

L'agent `dtfs-hono-api-generator` génère les routes Hono depuis le `BackendContract`. L'agent `dtfs-backend-contract-compiler` compile ce contrat.

## Status

Accepted.

---

## Context

Le choix du framework HTTP pour les apps générées doit satisfaire plusieurs contraintes : typesafety end-to-end avec le frontend, support des runtimes Node et Edge, légèreté, compatibilité avec `better-auth`, et compatibilité avec `@hono/client` pour le SDK typé côté frontend.

## Decision

Hono 4 est utilisé comme framework HTTP pour :
1. Le serveur Control Plane lui-même (`backend/src/server.ts`).
2. Les applications générées (`apps/api/src/index.ts` + `apps/api/src/routes/*.ts`).

L'`AppType` exporté par le backend Control Plane permet au frontend DTFS de consommer l'API via `hono/client` avec un typage bout-en-bout. Le même pattern est reproduit dans les apps générées.

Les routes générées suivent la convention `apps/api/src/routes/<resource>.ts` avec un handler par opération CRUD.

## Consequences

**Positif :**
- TypeScript end-to-end sans génération de client supplémentaire.
- Compatible Node.js et Edge workers (Cloudflare Workers, etc.).
- Très léger (< 20 KB bundle).
- `better-auth` dispose d'un adaptateur Hono natif.

**Négatif / Contrainte :**
- Les middlewares de policy backend (PolicyRule → middleware Hono) sont actuellement des stubs pass-through — la compilation réelle est en backlog P1.
- Peu de tooling de documentation automatique comparé à Express + Swagger.

## Alternatives considered

- **Express 5** : plus connu mais pas de typesafety native, pas d'AppType pattern.
- **Fastify** : meilleure performance, mais écosystème TypeScript moins propre pour le pattern RPC typé.
- **tRPC** : excellent pour le RPC typé, mais peu adapté à la génération de routes REST documentées OpenAPI.

## Related documents

- [[ADR-0006-use-better-auth]]
- [[ADR-0008-use-contract-compilation-before-codegen]]
- [[../05_Generated_App/HONO_GENERATION]]
- [[../04_Runtime_Contracts/BACKEND_CONTRACT]]
