# RuntimeTarget

Le **RuntimeTarget** décrit la *cible technique* d'un projet : quelle stack générer (backend, auth,
frontend, base, ORM, package manager, runtime). C'est le **plan technique**, distinct de l'instance
réellement lancée. Il pilote la compilation des trois contrats puis le codegen.

Liens : [[BACKEND_CONTRACT]] · [[FRONTEND_CONTRACT]] · [[SHARED_CONTRACT]] · [[CONTRACT_COMPILATION]] · [[../05_Generated_App/GENERATED_APP_OVERVIEW]] · [[../12_Operations/RUNTIME_INSTANCES]] · [[../02_Architecture/CLIENT_APP_RUNTIME]]

## RuntimeTarget vs RuntimeInstance vs DeploymentTarget

| Concept | Sens | État |
|---|---|---|
| **RuntimeTarget** | Le *plan* : « cette app sera générée pour Hono + Better Auth + Next 16 + Postgres/Prisma + pnpm + Node ». | implemented (modèle Prisma + `lib/contracts/runtime-target.ts`) |
| **RuntimeInstance** | Une *instance réellement lancée* (conteneurs up, ports, healthcheck). | cible — non implémenté |
| **DeploymentTarget** | *Où* l'instance tourne (local, staging, prod). | placeholder (modèle présent, logique cible) |

## Champs (modèle réel)

```jsonc
{
  "name": "hono-next",                 // unique par projet
  "backend":  { "framework": "hono", "versionPolicy": "latest-stable", "runtime": "node", "apiStyle": "rest" },
  "frontend": { "framework": "next", "version": "16.x", "router": "app", "rendering": "server-components-first" },
  "auth":     { "provider": "better-auth", "basePath": "/api/auth" },
  "database": { "provider": "postgresql", "orm": "prisma" },
  "packageManager": "pnpm",            // pnpm | bun | npm
  "runtime": "node",                   // node | bun | edge (configurable)
  "config": { }                        // overrides libres
}
```

`DEFAULT_RUNTIME_TARGET` (`backend/src/lib/contracts/runtime-target.ts`) fournit la cible `hono-next`
ci-dessus quand aucun RuntimeTarget n'est défini. `getRuntimeTarget` retombe gracieusement sur ce
défaut (`source: "default"`) si la table n'existe pas ; `setRuntimeTarget` persiste en base (table
créée par la migration `control_plane_v1_3_runtime_contracts`, désormais appliquée → `source: "db"`).

## Rôle dans le pipeline

```
ProjectSpec committed
  → RuntimeTarget            (quelle stack ?)
  → compileBackendContract   (lit RuntimeTarget + Control Plane)
  → compileFrontendContract
  → compileSharedContract
  → validateContracts
  → Codegen                  (emit-prisma / shared / auth / hono / next / sdk / tests)
```

Le RuntimeTarget découple le Control Plane des cibles techniques : changer Hono→Fastify ou Next→Remix
se fait en changeant le RuntimeTarget + les emitters, **sans toucher** aux specs ni aux contrats.

## Source of truth
- Modèle : `backend/prisma/schema.prisma` (model `RuntimeTarget`, schéma `dtfs`).
- Logique : `backend/src/lib/contracts/runtime-target.ts` (`DEFAULT_RUNTIME_TARGET`, `getRuntimeTarget`, `setRuntimeTarget`).
- MCP : `dtfs__get_runtime_target`, `dtfs__set_runtime_target`. HTTP : `GET|PUT /api/projects/:id/contracts/runtime-target`.
- Doc historique : `docs/RUNTIME_TARGET.md`.

## AI usage
Avant tout codegen, lire ou définir le RuntimeTarget (`/dtfs:set-runtime`). Ne jamais coder en dur la
stack dans un emitter : la stack vient du RuntimeTarget. Ne pas confondre avec RuntimeInstance (lancement).

## Status
**implemented** (modèle + compile + get/set + persistance DB active). RuntimeInstance & DeploymentTarget : **documented / cible**.
