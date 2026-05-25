# BACKEND_CONTRACT

Le `BackendContract` est la représentation compilée et persistée de tout ce que le backend doit exposer : routes, schémas Zod, configuration auth, middlewares de policy, catalogue d'erreurs. Il est produit par `compileBackendContract(projectId)` à partir des concepts Control Plane (Entity, Resource, Operation, Policy, AuthMethod, Asset, EventDefinition). L'emitter Hono lit ce contrat — jamais le Control Plane directement.

Liens : [[RUNTIME_TARGET]] · [[SHARED_CONTRACT]] · [[CONTRACT_COMPILATION]] · [[CONTRACT_VALIDATION]] · [[../05_Generated_App/HONO_API_GENERATION]] · [[../05_Generated_App/BETTER_AUTH_GENERATION]]

---

## Source of truth

`docs/BACKEND_CONTRACT.md` · `backend/src/lib/contracts/compile-backend.ts` · `backend/prisma/schema.prisma` (modèle `BackendContract`, Phase 25)

---

## Shape du modèle

```
BackendContract {
  id              String   — cuid
  projectId       String   — FK Project
  runtimeTargetId String?  — FK RuntimeTarget (null → target défaut du projet)
  apiBasePath     String   — "/api" par défaut
  routes          Json     — RouteDescriptor[]
  schemas         Json     — SchemaDescriptor[]
  middlewares     Json?    — MiddlewareDescriptor[]
  auth            Json?    — BetterAuthConfigFragment
  errors          Json?    — ErrorDescriptor[]
  generatedFrom   Json?    — provenance { entities[], operations[], policies[], authMethods[] }
  createdAt       DateTime
  updatedAt       DateTime
}
```

---

## Mapping Control Plane → BackendContract

| Concept Control Plane | Ce que ça devient dans BackendContract |
|---|---|
| `Entity` | Descripteur Prisma + schéma Zod + type TypeScript + Repository + DTO + famille `/api/<entity>` |
| `Attribute` | Colonne DB + champ Zod + règle de validation + champ DTO entrée/sortie |
| `Resource` | Famille de routes Hono CRUD (`GET /`, `GET /:id`, `POST /`, `PATCH /:id`, `DELETE /:id`) filtrées par `exposedOps` |
| `Operation` | Endpoint `POST /api/operations/<name>` avec schéma entrée/sortie, handler stub, checks policy, mapping erreur |
| `Policy` | Descripteur middleware Hono + fonction de vérification de permission |
| `AuthMethod` (SESSION) | Config Better Auth email/password + handler `/api/auth/*` + descripteur middleware session |
| `AuthMethod` (API_KEY) | Config Better Auth API-key + middleware bearer |
| `Asset` | Routes `POST /api/assets`, `GET /api/assets/:id`, `GET /api/assets/:id/raw` (cible — absent du compilateur actuel, cf. AUDIT_REPORT P1) |
| `EventDefinition` | Descripteur payload typé + stub emitter + stub fixture de test |
| `Workflow` / `Trigger` | Stub descripteur orchestration (planifié, pas encore implémenté) |

---

## Shape des sous-types clés

### RouteDescriptor

```jsonc
{
  "method": "GET",
  "path": "/api/customers/:id",
  "kind": "resource",          // "resource"|"operation"|"auth"|"asset"|"system"
  "operationId": "getCustomer",
  "inputSchema": "CustomerGetParams",
  "outputSchema": "CustomerResponse",
  "middlewares": ["requireSession"],
  "source": { "kind": "Resource", "id": "res_xxx" }
}
```

### SchemaDescriptor

```jsonc
{
  "name": "CustomerSchema",
  "kind": "entity",            // "entity"|"input"|"output"|"dto"|"error"
  "zod": "z.object({ id: z.string(), email: z.string().email() })",
  "typescript": "type Customer = { id: string; email: string }",
  "source": { "kind": "Entity", "id": "ent_xxx" }
}
```

### Auth Config Fragment (SESSION)

```jsonc
{
  "provider": "better-auth",
  "basePath": "/api/auth",
  "emailPassword": true,
  "sessionDuration": 604800,
  "tables": ["user", "session", "account", "verification"],
  "middleware": "requireSession"
}
```

---

## Catalogue d'erreurs standard

```
NOT_FOUND    → HTTP 404
FORBIDDEN    → HTTP 403
UNAUTHORIZED → HTTP 401
VALIDATION   → HTTP 422  (+ issues: ZodIssue[])
CONFLICT     → HTTP 409
SERVER_ERROR → HTTP 500
```

Ces codes sont repris dans `SharedContract.errors` et émis dans `packages/shared/src/errors.ts`.

---

## Étapes de compilation (`compileBackendContract`)

1. Charger le `RuntimeTarget` du projet.
2. Charger Entity, Attribute, EntityRelation, Resource, Operation, Policy, AuthMethod, Asset, EventDefinition.
3. Pour chaque Entity → descripteur schéma + descripteurs DTO.
4. Pour chaque Resource → famille de routes filtrée par `exposedOps`.
5. Pour chaque Operation → endpoint POST explicite.
6. Pour chaque Policy → descripteur middleware.
7. Pour chaque AuthMethod → fragment config auth + middleware session.
8. Pour chaque Asset → descripteurs routes asset.
9. Pour chaque EventDefinition → descripteur payload événement.
10. Collecte erreurs → catalogue d'erreurs.
11. Écrire/mettre à jour la ligne `BackendContract` en DB (ou retourner in-memory).

---

## AI usage

Lire ce contrat avant d'invoquer un emitter backend. Ne jamais lire Entity/Operation/Policy bruts depuis un emitter. Si `generatedFrom` est vide, la compilation n'a pas encore été exécutée.

## Status

`documented` — `compileBackendContract` implémenté dans `compile-backend.ts` ; persistance DB disponible (Phase 25) ; Asset absent du compilateur actuel (AUDIT_REPORT P1) ; guards policies = stubs pass-through.
