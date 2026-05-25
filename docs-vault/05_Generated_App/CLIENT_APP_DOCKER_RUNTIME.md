# CLIENT_APP_DOCKER_RUNTIME

Le docker-compose client est la cible de déploiement local de l'application générée. Il orchestre `client-api` (Hono), `client-web` (Next.js), `client-db` (PostgreSQL), et optionnellement `redis` et un stockage objet. Les migrations Prisma et le seed sont exécutés via un service `migrate` éphémère au démarrage.

Liens : [[GENERATED_APP_OVERVIEW]] · [[CLIENT_DATABASE]] · [[HONO_API_GENERATION]] · [[NEXT16_GENERATION]]

---

## Source of truth

`docs/RUNTIME_CONTRACTS_OVERVIEW.md` § 6 · `docs/CODEGEN.md` (arborescence cible)

---

## Distinctions importantes

| Terme | Définition |
|---|---|
| `RuntimeTarget` | Plan technique déclaré (framework, version, ORM) — pas une adresse |
| `RuntimeInstance` | Instance en cours d'exécution de l'app générée (un processus, un conteneur) |
| `DeploymentTarget` | Lieu de déploiement (docker-compose local, Fly.io, Railway, Vercel…) |

Le docker-compose est un `DeploymentTarget` local qui instancie un `RuntimeInstance` de l'app générée selon son `RuntimeTarget`.

---

## Services cibles

```yaml
services:
  client-db:
    image: postgres:16
    environment:
      POSTGRES_DB: client_app
      POSTGRES_USER: dtfs
      POSTGRES_PASSWORD: ${CLIENT_DB_PASSWORD}
    volumes:
      - client-db-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U dtfs"]
      interval: 5s
      retries: 10

  migrate:
    build: { context: ., dockerfile: apps/api/Dockerfile }
    command: ["pnpm", "prisma", "migrate", "deploy"]
    depends_on:
      client-db: { condition: service_healthy }
    environment:
      DATABASE_URL: postgresql://dtfs:${CLIENT_DB_PASSWORD}@client-db:5432/client_app

  client-api:
    build: { context: ., dockerfile: apps/api/Dockerfile }
    ports: ["4000:4000"]
    depends_on:
      migrate: { condition: service_completed_successfully }
    environment:
      DATABASE_URL: postgresql://dtfs:${CLIENT_DB_PASSWORD}@client-db:5432/client_app
      BETTER_AUTH_SECRET: ${BETTER_AUTH_SECRET}
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:4000/health || exit 1"]

  client-web:
    build: { context: ., dockerfile: apps/web/Dockerfile }
    ports: ["3000:3000"]
    depends_on:
      client-api: { condition: service_healthy }
    environment:
      NEXT_PUBLIC_API_URL: http://client-api:4000
```

Services optionnels (ajoutés si présents dans `RuntimeTarget.config`) :
- `redis` : cache sessions ou queues d'événements.
- `minio` : stockage objet pour les assets (si Asset présent dans BackendContract).

---

## Séquence de démarrage

```
client-db (healthy)
  → migrate (migrations Prisma + seed optionnel)
    → client-api (healthy)
      → client-web
```

---

## Variables d'environnement requises

| Variable | Service | Description |
|---|---|---|
| `CLIENT_DB_PASSWORD` | client-db, migrate, client-api | Mot de passe Postgres |
| `BETTER_AUTH_SECRET` | client-api | Secret Better Auth (32+ chars) |
| `NEXT_PUBLIC_API_URL` | client-web | URL publique de l'API |

---

## AI usage

Ce fichier décrit la cible — le docker-compose n'est pas encore émis par le codegen (AUDIT_REPORT). Pour tester l'app générée localement, démarrer `client-db` manuellement, appliquer les migrations Prisma, puis lancer `client-api` et `client-web` en mode développement.

## Status

`documented` — **cible non implémentée** ; le docker-compose n'est pas encore émis par le codegen (Phase 28+ work).
