# Client App Start/Stop

Workflow complet pour démarrer, utiliser et arrêter une application générée par DTFS. De la génération au health check.

Liens : [[DOCKER]] · [[RUNTIME_INSTANCES]] · [[../05_Generated_App/CODEGEN]] · [[../10_Agents_MCP_Skills/SKILLS_AND_COMMANDS]].

## Source of truth

Cible — procédure opérationnelle pour les apps générées. `backend/src/codegen/codegen.ts` pour la génération. `dtfs__run_generated_tests` (stub V1).

## AI usage

L'agent `dtfs-codegen-orchestrator` pilote les étapes generate → dry-run → confirm → write. Les étapes build → run → test restent manuelles en V1.

## Status

Cible. Génération OK (V1). Build → run → test : manuel ou stub.

---

## Workflow complet

### Étape 1 — Générer l'application

```bash
# Via Claude Code
/dtfs:set-runtime <projectId>
/dtfs:compile-contracts <projectId>
/dtfs:generate-app <projectId>
# → confirmer après dry-run
# → fichiers écrits dans outDir (ex: /tmp/generated/<projectId>/)
```

### Étape 2 — Vérifier la structure

```bash
/dtfs:check-generated <projectId> --out /tmp/generated/<projectId>
# → rapport PASS/WARNINGS/BLOCKED
```

### Étape 3 — Builder l'application (manuel V1)

```bash
cd /tmp/generated/<projectId>

# Installer les dépendances
pnpm install

# Typecheck
pnpm typecheck  # ou tsc --noEmit
```

### Étape 4 — Démarrer la DB (Docker)

```bash
docker compose up -d db
# Attendre que PostgreSQL soit prêt
docker compose exec db pg_isready -U app_user
```

### Étape 5 — Migrer la DB client

```bash
# Dans outDir
pnpm prisma migrate deploy
# ou
docker compose run --rm api pnpm prisma migrate deploy
```

### Étape 6 — Seeder (optionnel)

```bash
pnpm run seed
# ou
docker compose run --rm api pnpm run seed
```

### Étape 7 — Démarrer l'application

```bash
docker compose up -d
# ou en développement local :
pnpm dev  # backend + frontend en parallèle
```

### Étape 8 — Health check

```bash
curl http://localhost:4000/api/health
# → {"ok": true, "version": "..."}

curl http://localhost:3000
# → Page d'accueil Next.js
```

### Étape 9 — Lancer les tests générés

```bash
/dtfs:run-generated-tests <projectId> --out /tmp/generated/<projectId>
# V1 : retourne skipped: true
# V2 : exécute pnpm test dans outDir
```

### Étape 10 — Arrêter l'application

```bash
docker compose down
# Ou pour supprimer aussi les volumes DB :
docker compose down -v
```

---

## Arborescence outDir attendue

```
/tmp/generated/<projectId>/
  prisma/
    schema.prisma
  apps/
    api/
      src/
        index.ts
        routes/<resource>.ts
        repositories/<Entity>.repository.ts
        auth.ts
    web/
      app/
        layout.tsx
        <screen-slug>/
          page.tsx
      lib/
        api/
          client.ts
  packages/
    shared/
      src/
        schemas/index.ts
        types/index.ts
        errors.ts
        api-contract.ts
        sdk/
          client.ts
          index.ts
  tests/
    api/*.test.ts
    contract/contracts.test.ts
    e2e/smoke.test.ts
  docker-compose.yml     # cible — non généré V1
  .dtfs-manifest.json    # manifest avec contentHash par fichier
```

---

## Preview sans écriture (dry-run)

```bash
# Via MCP
dtfs__generate_app(projectId, { dryRun: true })
# → retourne le plan : fichiers, couches, estimations
# → aucun fichier écrit sur disque
```

Le dry-run est **obligatoire** avant tout write (enforced par l'orchestrateur).
