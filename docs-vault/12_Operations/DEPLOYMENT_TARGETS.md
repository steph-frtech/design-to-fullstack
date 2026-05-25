# Deployment Targets

Un `DeploymentTarget` définit le lieu d'exécution d'une application générée (où elle tourne, pas comment elle a été construite). Distinct du `RuntimeTarget` (choix de stack) et de la `RuntimeInstance` (instance lancée).

Liens : [[RUNTIME_INSTANCES]] · [[DOCKER]] · [[../04_Runtime_Contracts/RUNTIME_TARGET]] · [[../09_ADR/ADR-0004-separate-control-plane-and-client-runtime]].

## Source of truth

Cible — modèle `DeploymentTarget` non encore présent dans `backend/prisma/schema.prisma` (planifié post-Phase 29).

## AI usage

Aucun agent ne gère les DeploymentTarget en V1. Le RuntimeTarget suffit pour piloter le codegen.

## Status

Cible / placeholder. Non implémenté en V1.

---

## Distinction des trois concepts

| Concept | Quoi | Quand |
|---------|------|-------|
| `RuntimeTarget` | Choix de stack (Hono 4, Next.js 16, Better Auth, Prisma, outputDir) | Avant la génération |
| `DeploymentTarget` | Lieu d'exécution (localhost, Fly.io, Vercel, Railway, Docker Swarm) | Avant le déploiement |
| `RuntimeInstance` | Instance lancée d'une app générée (PID, URL, status) | Après le démarrage |

Ces trois concepts sont délibérément séparés pour permettre de changer le lieu de déploiement sans régénérer l'app.

---

## DeploymentTarget — Types planifiés

| Type | Description | Status |
|------|-------------|--------|
| `local` | Localhost via docker-compose | Cible V2 |
| `fly` | Fly.io via `flyctl deploy` | Cible V3 |
| `vercel` | Vercel via CLI | Cible V3 |
| `railway` | Railway via CLI | Cible V3 |
| `docker-swarm` | Cluster Docker | Cible V4 |
| `kubernetes` | K8s via Helm | Cible V4 |

---

## Modèle Prisma cible

```prisma
// Cible — non encore dans schema.prisma
model DeploymentTarget {
  id          String   @id @default(cuid())
  projectId   String
  project     Project  @relation(fields: [projectId], references: [id])
  kind        DeploymentTargetKind
  config      Json     // {host, region, envVars, ...}
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@map("deployment_targets")
}

enum DeploymentTargetKind {
  LOCAL
  FLY
  VERCEL
  RAILWAY
  DOCKER_SWARM
  KUBERNETES
}
```

---

## En attendant V2

En V1, le déploiement est entièrement manuel :
1. Générer l'app via `/dtfs:generate-app`.
2. Copier `outDir/` sur le serveur cible.
3. Suivre les procédures manuelles de la plateforme cible.

Voir [[CLIENT_APP_START_STOP]] pour le workflow local complet.
