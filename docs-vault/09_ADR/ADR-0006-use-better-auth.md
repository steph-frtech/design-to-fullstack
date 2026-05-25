# ADR-0006 — Better Auth pour l'authentification

Les applications générées utilisent Better Auth comme couche d'authentification, cantonnée à `apps/api/src/auth.ts`.

Liens : [[ADR-0005-use-hono-for-generated-api]] · [[../05_Generated_App/BETTER_AUTH_GENERATION]].

## Source of truth

`backend/src/codegen/emit-auth.ts`.

## AI usage

L'agent `dtfs-better-auth-generator` génère `auth.ts` depuis le `BackendContract.auth`. Les `AuthMethod` du DeltaSpec alimentent ce contrat.

## Status

Accepted.

---

## Context

L'authentification est l'un des aspects les plus sensibles d'une application générée. La solution doit : être configurable depuis le modèle DTFS (AuthMethod), s'intégrer à Hono, supporter plusieurs stratégies (email/password, OAuth, magic link, API key), et éviter de coupler le codegen à une implémentation spécifique.

## Decision

Better Auth est la librairie d'authentification utilisée dans les apps générées. Elle est :
1. Configurée à partir des `AuthMethod` du Control Plane (kind : `EMAIL_PASSWORD`, `OAUTH`, `MAGIC_LINK`, `APIKEY`).
2. Cantonnée au fichier `apps/api/src/auth.ts` (un seul point de configuration).
3. Exposée via le handler `/api/auth/*` monté dans Hono.
4. Isolée : aucun autre fichier généré ne dépend directement de Better Auth (seulement via le type `AuthSession`).

L'`AuthSession` est exporté dans le `SharedContract` pour que le frontend puisse typer les sessions.

**Note :** Le handler `/api/auth/*` et les middlewares de session sont actuellement des stubs de configuration. L'émission complète est en backlog P1.

## Consequences

**Positif :**
- Isolation complète de la logique auth dans un seul fichier.
- Support natif des providers OAuth via `better-auth/providers`.
- Compatible Hono via `toHonoHandler()`.
- Pas de dépendance auth dans le SharedContract (seulement le type `AuthSession`).

**Négatif / Contrainte :**
- Doublon enum `APIKEY`/`API_KEY` dans le schéma Prisma à résoudre (backlog P1).
- Handler `/api/auth/*` actuellement stub — l'authentification fonctionnelle nécessite la complétion du codegen.

## Alternatives considered

- **NextAuth / Auth.js** : lié à Next.js, difficile à utiliser côté backend Hono.
- **Lucia Auth** : déprécié, communauté fragmentée.
- **Clerk** : SaaS, pas de génération locale, dépendance externe forte.
- **Custom JWT** : trop de code à générer, risque de failles sécurité.

## Related documents

- [[ADR-0005-use-hono-for-generated-api]]
- [[ADR-0007-use-next16]]
- [[../05_Generated_App/BETTER_AUTH_GENERATION]]
- [[../04_Runtime_Contracts/BACKEND_CONTRACT]]
