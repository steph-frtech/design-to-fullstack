# Docker

Docker et docker-compose pour l'application cliente générée. Le Control Plane DTFS lui-même ne nécessite pas Docker en développement local.

Liens : [[CLIENT_APP_START_STOP]] · [[DEPLOYMENT_TARGETS]] · [[../09_ADR/ADR-0004-separate-control-plane-and-client-runtime]].

## Source of truth

Cible — les fichiers `docker-compose.yml` sont générés dans `outDir` par le codegen. Non encore implémenté (backlog).

## AI usage

Les agents de codegen généreront les fichiers Docker dans l'arborescence de l'app cible. Le Control Plane DTFS ne gère pas l'exécution Docker.

## Status

Cible. Non implémenté en V1.

---

## Architecture cible

L'application générée comprend un `docker-compose.yml` dans `outDir/` avec les services :

```yaml
# docker-compose.yml (cible — non généré en V1)
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_DB: app_db
      POSTGRES_USER: app_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - db_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  api:
    build: ./apps/api
    environment:
      DATABASE_URL: postgresql://app_user:${DB_PASSWORD}@db:5432/app_db
      BETTER_AUTH_SECRET: ${BETTER_AUTH_SECRET}
    ports:
      - "4000:4000"
    depends_on:
      - db

  web:
    build: ./apps/web
    environment:
      NEXT_PUBLIC_API_URL: http://api:4000
    ports:
      - "3000:3000"
    depends_on:
      - api

volumes:
  db_data:
```

---

## Workflow cible

```bash
# Dans outDir/ de l'app générée
docker compose up -d db          # Démarrer la DB en premier
docker compose run --rm api \
  pnpm prisma migrate deploy     # Appliquer les migrations
docker compose up -d             # Démarrer tous les services
```

Voir [[CLIENT_APP_START_STOP]] pour le workflow complet generate → run.

---

## Dockerfile cibles (non générés en V1)

### Backend (Hono / Node)

```dockerfile
# apps/api/Dockerfile (cible)
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
CMD ["node", "src/index.js"]
```

### Frontend (Next.js)

```dockerfile
# apps/web/Dockerfile (cible)
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
CMD ["node", "server.js"]
```

---

## Note sur le Control Plane en prod

Le Control Plane DTFS peut également être containerisé mais cela sort du scope V1. En développement, il s'exécute directement via `pnpm dev:backend`. La DB du Control Plane est distincte de la DB de l'app générée (voir [[../09_ADR/ADR-0004-separate-control-plane-and-client-runtime]]).
