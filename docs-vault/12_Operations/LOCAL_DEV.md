# Local Development

Procédure de démarrage du Control Plane DTFS en local. Le backend écoute sur le port défini dans `.env`, le frontend sur `:3000` par défaut.

Liens : [[MIGRATIONS]] · [[TROUBLESHOOTING]] · [[../09_ADR/ADR-0004-separate-control-plane-and-client-runtime]].

## Source of truth

`backend/package.json` (scripts) · `CLAUDE.md` (commandes officielles) · `.env` racine.

## AI usage

Les agents n'utilisent pas ces commandes directement — elles sont pour les développeurs humains. Les agents interagissent avec le backend via les outils MCP.

## Status

Actif. Backend + frontend opérationnels en local (Phase 29).

---

## Prérequis

1. PostgreSQL disponible (locale ou Docker).
2. Fichier `.env` à la racine du repo avec `DATABASE_URL`.
3. `pnpm` 10 installé.

```bash
# Depuis la racine du repo
pnpm install          # Installer toutes les workspaces
pnpm rebuild -r       # Si les postinstall n'ont pas tourné (esbuild, sharp, prisma)
```

---

## Démarrer le Control Plane

### Backend (API + MCP server)

```bash
# Démarrer le backend avec hot-reload (tsx watch)
pnpm dev:backend
# → écoute sur le port configuré dans .env (typiquement :4000 ou :4002)
```

Script sous-jacent (`backend/package.json`) :
```json
"dev": "tsx watch --env-file=../.env src/server.ts"
```

### Frontend DTFS

```bash
# Démarrer le frontend Next.js
pnpm dev:web
# → http://localhost:3000
```

### Serveur MCP (stdio)

```bash
# Démarrer le serveur MCP sur stdio (pour Claude Code)
pnpm --filter backend mcp
```

Script : `tsx --env-file=../.env src/mcp-server.ts`

---

## Base de données

```bash
# Générer le client Prisma
pnpm --filter backend db:generate

# Créer/appliquer les migrations en dev
pnpm --filter backend db:migrate

# Interface graphique Prisma Studio
pnpm --filter backend db:studio
```

---

## Typecheck et lint

```bash
# Typecheck toutes les workspaces
pnpm typecheck

# Lint Biome
pnpm lint

# Format Biome
pnpm format
```

---

## Tests

```bash
# Depuis backend/
cd backend

# Tous les tests (unit + golden + e2e) — nécessite DATABASE_URL
pnpm test

# Unit uniquement (pas de DB)
pnpm test:unit

# E2E uniquement
pnpm test:e2e
```

---

## Ports par défaut

| Service | Port | Commande |
|---------|------|---------|
| Backend DTFS | `:4000` (ou `:4002`) | `pnpm dev:backend` |
| Frontend DTFS | `:3000` | `pnpm dev:web` |
| MCP server | stdio | `pnpm --filter backend mcp` |
| App générée | configurable | Voir [[CLIENT_APP_START_STOP]] |

---

## Variables d'environnement clés

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Connexion PostgreSQL Control Plane |
| `DTFS_AUDIT_LOG` | Chemin du log d'audit JSONL (défaut: `/tmp/dtfs-audit.jsonl`) |
| `DTFS_AUDIT_DB` | `1` pour persister les events d'audit en DB (nécessite migration Phase 10) |
| `BETTER_AUTH_SECRET` | Secret Better Auth (Control Plane UI) |
| `FIGMA_TOKEN` | Token Figma pour l'import live (optionnel) |
