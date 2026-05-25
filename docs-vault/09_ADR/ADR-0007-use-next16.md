# ADR-0007 — Next.js 16 App Router pour le frontend généré

Les applications générées par DTFS utilisent Next.js 16 avec l'App Router comme framework frontend.

Liens : [[ADR-0005-use-hono-for-generated-api]] · [[../05_Generated_App/NEXT16_GENERATION]].

## Source of truth

`backend/src/codegen/emit-next.ts` · `frontend/web/` (Control Plane UI).

## AI usage

L'agent `dtfs-next16-generator` génère les pages depuis le `FrontendContract`. L'agent `dtfs-frontend-contract-compiler` compile ce contrat depuis les Screen/Component/Form/Field/Action/DataBinding du Control Plane.

## Status

Accepted.

---

## Context

Le frontend des applications générées doit : s'intégrer au SDK typé généré (AppType via `hono/client`), supporter le Server Components pour les pages de lecture, utiliser React 19, et être générable de façon déterministe depuis le `FrontendContract`.

## Decision

Next.js 16 App Router est utilisé pour le frontend des apps générées, avec :
- Une page par `Screen` du FrontendContract : `apps/web/app/<route>/page.tsx`.
- Un `layout.tsx` racine pour les providers.
- Le SDK typé consommé via `apps/web/lib/api/client.ts`.
- Les composants client marqués `"use client"` quand ils portent de l'état.

Le Control Plane DTFS lui-même utilise également Next.js 16 (App Router) pour son propre frontend (`frontend/web/`), garantissant la cohérence de la stack.

**Note :** Les forms/fields/actions/dataBindings sont compilés dans le `FrontendContract` mais `emit-next.ts` ne les consomme pas encore — les pages générées sont quasi-vides (backlog P1).

## Consequences

**Positif :**
- Server Components pour les pages de lecture (performance).
- App Router = file-system routing déterministe depuis les Screen slugs.
- React 19 + Suspense natif.
- Le Control Plane DTFS est lui-même un exemple de la stack générée.

**Négatif / Contrainte :**
- Pages générées quasi-vides : forms/actions/dataBindings non émis.
- SDK typé généré mais non importé dans les pages stubs.
- `tsconfig.json` non généré → `typecheckGeneratedProject` ne peut pas tourner (V2).

## Alternatives considered

- **Remix** : excellent routeur, mais moins adapté à la génération déterministe page-par-page.
- **SvelteKit** : hors scope de la stack TypeScript/React choisie.
- **Vite + React SPA** : pas de SSR, pas de file-system routing.

## Related documents

- [[ADR-0005-use-hono-for-generated-api]]
- [[ADR-0006-use-better-auth]]
- [[../05_Generated_App/NEXT16_GENERATION]]
- [[../04_Runtime_Contracts/FRONTEND_CONTRACT]]
