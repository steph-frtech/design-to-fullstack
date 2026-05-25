# SHARED_CONTRACT

Le `SharedContract` est le pont entre le backend et le frontend. Il compile les types TypeScript, schémas Zod, surface API client, codes d'erreur et payloads d'événements partagés par les deux côtés. Il drive la génération de `packages/shared/` dans le monorepo généré — le seul package importé à la fois par `apps/api/` et `apps/web/`. Il est produit par `compileSharedContract(projectId)` après `compileBackendContract` et `compileFrontendContract`.

Liens : [[BACKEND_CONTRACT]] · [[FRONTEND_CONTRACT]] · [[CONTRACT_COMPILATION]] · [[../05_Generated_App/SHARED_SDK_GENERATION]]

---

## Source of truth

`docs/SHARED_CONTRACT.md` · `backend/src/lib/contracts/compile-shared.ts` · `backend/prisma/schema.prisma` (modèle `SharedContract`, Phase 25)

---

## Shape du modèle

```
SharedContract {
  id          String   — cuid
  projectId   String   — FK Project
  types       Json     — TypeDescriptor[]
  schemas     Json     — ZodSchemaDescriptor[]
  apiClient   Json?    — ApiClientDescriptor[]
  errors      Json?    — ErrorTypeDescriptor[]
  events      Json?    — EventPayloadDescriptor[]
  createdAt   DateTime
  updatedAt   DateTime
}
```

---

## Contenu par source Control Plane

| Élément | Dérivé de |
|---|---|
| Types DTO Entity | `Entity.attributes` → `interface` TypeScript |
| DTOs entrée | `Operation.inputSchema` + `Form.fields` → `z.object(...)` |
| DTOs sortie | `Operation.outputSchema` → type réponse |
| Types réponse API | `Resource.exposedOps` → shapes CRUD standard |
| Types erreur API | `BackendContract.errors` → enum `ErrorCode` + type `ApiError<Code>` |
| Type session auth | `AuthMethod` → shape Better Auth (`Session`, `User`) |
| Type rôle | Clés `AppRole` → union TypeScript `AppRoleKey` |
| Types payload événement | `EventDefinition.payloadSchema` → `interface EventPayload<Name>` |
| Schémas Zod | Tous les éléments ci-dessus exprimés en `z.object(...)` |

---

## Shape des sous-types clés

### TypeDescriptor

```jsonc
{
  "name": "Customer",
  "kind": "entity",   // "entity"|"input"|"output"|"error"|"session"|"role"|"event"
  "typescript": "export interface Customer { id: string; email: string; name: string; createdAt: Date }",
  "source": { "kind": "Entity", "id": "ent_xxx" }
}
```

### ZodSchemaDescriptor

```jsonc
{
  "name": "CustomerSchema",
  "kind": "entity",
  "zod": "export const CustomerSchema = z.object({ id: z.string(), email: z.string().email() })",
  "source": { "kind": "Entity", "id": "ent_xxx" }
}
```

### ApiClientDescriptor

```jsonc
{
  "name": "getCustomer",
  "method": "GET",
  "path": "/api/customers/:id",
  "params": { "id": "string" },
  "outputSchema": "CustomerResponse",
  "signature": "getCustomer(id: string): Promise<CustomerResponse>"
}
```

---

## Structure du package généré

```
packages/shared/
  src/
    types/
      customer.ts          ← Customer, CustomerInput, CustomerResponse
      auth.ts              ← AuthSession, AuthUser
      roles.ts             ← AppRoleKey
      events.ts            ← payloads d'événements
      index.ts             ← barrel
    schemas/
      customer.ts          ← CustomerSchema, CustomerInputSchema
      index.ts
    errors.ts              ← ErrorCode enum + shapes ApiError
    api-contract.ts        ← signatures API client (typed SDK)
    index.ts               ← API publique du package
  package.json
  tsconfig.json
```

---

## Ordre de compilation (dépendance)

```
compileBackendContract(projectId)
  ↓
compileFrontendContract(projectId)
  ↓
compileSharedContract(projectId)   ← lit les deux
  ↓
validateContracts(projectId)
  ↓
generateApp()
```

`SharedContract` doit être compilé APRÈS `BackendContract` car il lit le catalogue d'erreurs et la table des routes.

---

## AI usage

Ne pas générer `packages/shared/` sans une `SharedContract` valide. Vérifier que `errors` et `apiClient` sont peuplés (ils requièrent `BackendContract`). Si `apiClient` est vide, le SDK typé ne sera pas généré.

## Status

`documented` — `compileSharedContract` implémenté ; persistance DB disponible (Phase 25).
