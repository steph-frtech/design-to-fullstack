# Generated App Tests

Tests de l'application générée par le codegen DTFS. État V1 : stubs only — `runGeneratedTests` retourne toujours `skipped: true`. Cible V2 : tests exécutables sur l'app générée.

Liens : [[TEST_STRATEGY]] · [[CONTRACT_TESTS]] · [[../12_Operations/CLIENT_APP_START_STOP]] · [[../05_Generated_App/CODEGEN]].

## Source of truth

`backend/src/codegen/emit-tests.ts` · `backend/src/codegen/codegen.ts:451` · `dtfs__run_generated_tests` (outil MCP, stub).

## AI usage

L'agent `dtfs-generated-code-reviewer` lance une revue structurelle de l'app générée. Les tests générés eux-mêmes sont des stubs pour l'instant — ils existent dans l'arborescence mais ne s'exécutent pas.

## Status

V1 : stubs. `runGeneratedTests` → toujours skipped. V2 : backlog P1.

---

## État V1 — Stubs

Le codegen génère des fichiers de test dans l'arborescence :
```
tests/
  api/*.test.ts          # Tests des routes Hono générées (stubs)
  contract/
    contracts.test.ts    # Tests de contrat de l'app générée (stubs)
  e2e/
    smoke.test.ts        # Smoke test E2E (stub)
```

Ces fichiers existent et sont bien écrits sur disque par `emit-tests.ts`, mais :
- `dtfs__run_generated_tests` retourne `{ok: true, results: [], skipped: true}` sans exécuter les tests.
- `dtfs__typecheck_generated_project` tente `tsc --noEmit` mais échoue car aucun `tsconfig.json` n'est généré dans `outDir`.

---

## Cible V2 — Tests exécutables

L'app générée devra passer les catégories de tests suivantes :

### API Tests (routes Hono)

| Catégorie | Description | Prérequis |
|-----------|-------------|-----------|
| CRUD entity | `POST /api/<resource>`, `GET /api/<resource>/:id`, `PUT`, `DELETE` | DB migrée + seedée |
| Auth flows | `POST /api/auth/sign-in`, `POST /api/auth/sign-up` | Better Auth configuré |
| Policy enforcement | Routes protégées → 401/403 sans session | Middleware auth actif |
| Operation routes | Routes custom d'operations | Body Zod-valid |

### Frontend Tests (Next.js pages)

| Catégorie | Description |
|-----------|-------------|
| Page rendering | Chaque page Next.js se rend sans erreur |
| SDK calls | Client SDK typé appelle les bonnes routes |
| Form submit | Formulaires soumettent via les actions |

### Contract Tests (dans l'app générée)

| Catégorie | Description |
|-----------|-------------|
| `contracts.test.ts` | BackendContract == routes réelles, SharedContract == types exportés |
| Zod schemas | Chaque schema DTO est Zod-valid |
| API client | Tous les endpoints du contrat sont atteignables |

### E2E Smoke

| Test | Description |
|------|-------------|
| `smoke.test.ts` | Health check `/api/health` → 200 |
| Auth flow | Sign-up → sign-in → accès route protégée |
| CRUD cycle | Create → Read → Update → Delete d'une entité |

---

## Prérequis pour V2

1. **Générer `tsconfig.json`** dans `outDir` (actuellement manquant).
2. **Implémenter `runGeneratedTests`** : `child_process.spawn('pnpm test', { cwd: outDir })`.
3. **App générée opérationnelle** : database migrée, seed, serveur démarré.
4. **Middlewares policy réels** : remplacer les stubs pass-through.
5. **Handler auth `/api/auth/*`** : émission complète (pas stub de config).

---

## Checklist de revue actuelle (`dtfs-generated-code-reviewer`)

En attendant les tests exécutables V2, la revue structurelle couvre :

| Check | Description |
|-------|-------------|
| Structure layers | `prisma/`, `apps/api/`, `apps/web/`, `packages/shared/` présents |
| Protected files | Aucun fichier `.env` ou migration dans le manifest |
| TypeScript | `tsc --noEmit` si `tsconfig.json` présent |
| Secrets | Pas de `TODO`, `YOUR_SECRET_HERE`, `FIXME` dans les fichiers générés |
| `"use client"` | Composants avec état ont la directive |
| Route handlers | Pas de handlers vides (warning INFO) |
