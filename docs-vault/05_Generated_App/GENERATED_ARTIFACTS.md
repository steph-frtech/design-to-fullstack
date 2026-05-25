# GENERATED_ARTIFACTS

Le `GeneratedArtifact` est la couche de traçabilité entre le Control Plane (ce qui a été spécifié), les contrats (ce qui a été compilé) et le code sur disque (ce qui a été émis). Chaque fichier généré est associé à un contentHash SHA-256, un kind, un flag `protected` et des liens vers les contrats sources.

Liens : [[GENERATED_APP_OVERVIEW]] · [[../04_Runtime_Contracts/BACKEND_CONTRACT]] · [[../04_Runtime_Contracts/FRONTEND_CONTRACT]] · [[../04_Runtime_Contracts/SHARED_CONTRACT]]

---

## Source of truth

`docs/GENERATED_ARTIFACTS.md` · `backend/src/codegen/types.ts` · `backend/prisma/schema.prisma` (modèle `GeneratedArtifact`)

---

## Modèle actuel (Phase 0 skeleton — en DB)

```prisma
model GeneratedArtifact {
  id        String  @id @default(cuid())
  projectId String
  path      String
  kind      String?
  content   String?
  hash      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  project   Project  @relation(...)
}
```

---

## Modèle enrichi (Phase 25 — doc form)

```
GeneratedArtifact {
  id                 String    — cuid
  projectId          String    — FK Project
  runtimeTargetId    String?   — FK RuntimeTarget  ← ABSENT du modèle actuel (AUDIT_REPORT P1)
  backendContractId  String?   — FK BackendContract ← ABSENT
  frontendContractId String?   — FK FrontendContract ← ABSENT
  sharedContractId   String?   — FK SharedContract  ← ABSENT
  changeSetId        String?   — FK ChangeSet
  path               String    — chemin relatif dans l'outDir
  kind               GeneratedArtifactKind
  contentHash        String    — SHA-256 hex du contenu
  bytes              Int
  protected          Boolean   — si true, codegen ne réécrit pas ← codé en dur false (AUDIT_REPORT P0)
  ownership          String    — "generated"|"custom"|"mixed" ← ABSENT
  generatedAt        DateTime
  createdAt / updatedAt DateTime
  UNIQUE(projectId, path)
}
```

---

## GeneratedArtifactKind (enum)

| Valeur | Description |
|---|---|
| `PRISMA_SCHEMA` | `prisma/schema.prisma` |
| `HONO_ROUTE` | `apps/api/src/routes/<r>.ts` |
| `HONO_OPERATION` | `apps/api/src/operations/<op>.ts` |
| `HONO_POLICY` | `apps/api/src/policies/<p>.ts` |
| `HONO_REPOSITORY` | `apps/api/src/repositories/<e>.ts` |
| `HONO_MIDDLEWARE` | `apps/api/src/middleware/*.ts` |
| `BETTER_AUTH` | `apps/api/src/auth.ts` |
| `NEXT_PAGE` | `apps/web/app/**/*page.tsx` |
| `NEXT_COMPONENT` | `apps/web/components/generated/*.tsx` |
| `NEXT_LAYOUT` | `apps/web/app/**/layout.tsx` |
| `SHARED_TYPE` | `packages/shared/src/types/*.ts` |
| `SHARED_SCHEMA` | `packages/shared/src/schemas/*.ts` |
| `SHARED_ERRORS` | `packages/shared/src/errors.ts` |
| `SHARED_API_CONTRACT` | `packages/shared/src/api-contract.ts` |
| `SDK_CLIENT` | `apps/web/lib/api/*.ts` |
| `TEST_UNIT` | `tests/unit/*.test.ts` |
| `TEST_INTEGRATION` | `tests/integration/*.test.ts` |
| `TEST_E2E` | `tests/e2e/*.spec.ts` |
| `MANIFEST` | `.dtfs-manifest.json` |
| `CONFIG` | `package.json`, `tsconfig.json`, `next.config.ts` |

---

## Manifest `.dtfs-manifest.json`

Écrit à la racine de l'outDir à chaque run non-dryRun :

```json
{
  "projectId": "prj_xxx",
  "generatedAt": "2026-05-24T10:00:00.000Z",
  "outDir": "/tmp/dtfs-codegen-prj_xxx",
  "files": [
    {
      "path": "apps/api/src/routes/customers.ts",
      "kind": "HONO_ROUTE",
      "contentHash": "sha256:abc123...",
      "bytes": 1042,
      "protected": false
    }
  ]
}
```

**Note** : `protected` est codé en dur à `false` dans `ManifestEntry` (AUDIT_REPORT P0) — la détection « ne pas écraser un fichier manuel » ne se déclenche jamais.

---

## Linkage contrat → artifact

| Kind d'artifact | Lié à |
|---|---|
| `HONO_ROUTE`, `HONO_OPERATION`, `HONO_POLICY`, `BETTER_AUTH`, `PRISMA_SCHEMA` | `backendContractId` |
| `NEXT_PAGE`, `NEXT_COMPONENT`, `NEXT_LAYOUT` | `frontendContractId` |
| `SHARED_TYPE`, `SHARED_SCHEMA`, `SHARED_ERRORS`, `SHARED_API_CONTRACT`, `SDK_CLIENT` | `sharedContractId` |
| `TEST_*` | `backendContractId` + `frontendContractId` |
| `MANIFEST`, `CONFIG` | aucun lien contrat |

---

## Détection de drift

Sur re-codegen : si `contentHash` diffère et `protected = false` → réécrit. Si `protected = true` → skip (signalé comme drift). Actuellement inopérant car `protected` est toujours `false`.

---

## Champs absents (à corriger — AUDIT_REPORT P0/P1)

- `ownership` (`"generated"|"custom"|"mixed"`) — ABSENT
- `protected` (flag réel) — codé en dur `false` → P0
- `generatedFrom` — ABSENT
- `runtimeTargetId` — ABSENT

Migration additive requise (Phase 25+).

---

## AI usage

Utiliser `dtfs__list_generated_artifacts` pour inspecter les artifacts d'un projet. Ne pas éditer manuellement un fichier généré sans l'avoir d'abord marqué `protected` via `dtfs__protect_artifact` (Phase 26 — non encore enregistré).

## Status

`documented` — modèle Phase 0 en DB ; manifest + contentHash fonctionnels ; `protected` inopérant (P0) ; 4 champs enrichis absents (P1).
