# CONTRACT_TO_CODEGEN_MAPPING

Règle d'or : **les emitters lisent les contrats validés, jamais les concepts Control Plane bruts** (sauf `emit-prisma` qui lit `CodegenSpec.entities` directement — comportement documenté et délibéré). Ce fichier décrit quel contrat alimente quel emitter et vers quel répertoire de sortie.

Liens : [[BACKEND_CONTRACT]] · [[FRONTEND_CONTRACT]] · [[SHARED_CONTRACT]] · [[../05_Generated_App/GENERATED_APP_OVERVIEW]] · [[../05_Generated_App/HONO_API_GENERATION]] · [[../05_Generated_App/NEXT16_GENERATION]] · [[../05_Generated_App/SHARED_SDK_GENERATION]]

---

## Source of truth

`docs/CODEGEN.md` · `backend/src/codegen/codegen.ts` · `backend/src/codegen/emit-*.ts`

---

## Table de mapping contrat → emitter → sortie

| Emitter | Contrat d'entrée | Répertoire de sortie |
|---|---|---|
| `emitPrismaSchema` | `CodegenSpec.entities` (spec brut — exception documentée) | `prisma/schema.prisma` |
| `emitAuthRuntime` | `BackendContractObj.auth` | `apps/api/src/auth.ts` |
| `emitHonoBackendApi` | `BackendContractObj` (routes, schemas, middlewares) | `apps/api/src/` |
| `emitSharedPackage` | `SharedContractObj` (types, schemas, errors) | `packages/shared/src/` |
| `emitSdk` | `SharedContractObj.apiClient` | `packages/shared/src/sdk/` |
| `emitNextFrontend` | `FrontendContractObj` (pages, routes, components) | `apps/web/` |
| `emitTests` | `BackendContractObj` + `SharedContractObj` | `tests/` |

---

## Ordre d'émission dans `generateApp`

```
database  → emit-prisma      (prisma/schema.prisma)
shared    → emit-shared       (packages/shared/src/types/ + schemas/ + errors.ts)
auth      → emit-auth         (apps/api/src/auth.ts)
backend   → emit-hono         (apps/api/src/)
frontend  → emit-next         (apps/web/)
sdk       → emit-sdk          (packages/shared/src/sdk/ + apps/web/lib/api/)
tests     → emit-tests        (tests/)
```

Cet ordre garantit que les types partagés existent avant que le backend ou le frontend ne les importe.

---

## Exception documentée : emit-prisma lit le spec brut

`emit-prisma` lit `CodegenSpec.entities` directement plutôt que le `BackendContract`. Cette exception est délibérée : le schéma Prisma doit refléter exactement les Entities Control Plane sans transformation contractuelle (les types Prisma sont déterminés par `FieldType`, pas par les descripteurs de route). Voir `docs/CODEGEN.md` — section "Emitter mapping".

---

## Emitters legacy (Phase 17 — maintenus pour rétrocompatibilité)

| Emitter legacy | Lit | Sortie |
|---|---|---|
| `emitHonoRoutes` | `CodegenSpec` | `backend/src/routes/` |
| `emitNextPages` | `CodegenSpec` | `frontend/src/app/` |

Ces emitters sont utilisés par `dtfs__preview_generated_file`. Ne pas les modifier pour les adapter aux contrats — créer de nouveaux emitters Phase 28.

---

## AI usage

Avant de modifier un emitter, identifier son contrat d'entrée dans ce tableau. Ne jamais ajouter d'import Prisma/DB dans un emitter — les emitters sont stateless et lisent uniquement les objets contrats passés en paramètre.

## Status

`documented` — pipeline contract-driven implémenté dans `codegen.ts` ; `emitNextFrontend` ne consomme pas encore `forms`/`actions`/`dataBindings` (pages stubs — AUDIT_REPORT P1).
