# Runtime Instances

Une `RuntimeInstance` est une instance en cours d'exécution d'une application générée. Distinct du `RuntimeTarget` (plan de stack) et du `DeploymentTarget` (lieu de déploiement).

Liens : [[DEPLOYMENT_TARGETS]] · [[CLIENT_APP_START_STOP]] · [[../04_Runtime_Contracts/RUNTIME_TARGET]] · [[../09_ADR/ADR-0004-separate-control-plane-and-client-runtime]].

## Source of truth

Cible — modèle `RuntimeInstance` non encore présent dans `backend/prisma/schema.prisma`. Non implémenté en V1.

## AI usage

Aucun agent ne gère les RuntimeInstance en V1. L'orchestrateur génère les fichiers ; le démarrage effectif est manuel.

## Status

Cible. Non implémenté en V1.

---

## Les trois plans distincts

```
RuntimeTarget          →  RuntimeInstance       ←  DeploymentTarget
(stack choisie)           (instance lancée)        (où elle tourne)

Ex: Hono4 + Next16       Ex: PID 12345,             Ex: local:localhost
    outputDir: /tmp/         URL: localhost:4000,        ou fly.io:myapp
    generated/proj-1/        status: RUNNING,
                             startedAt: 2026-05-25
```

**RuntimeTarget** répond à : "Avec quelle stack coder ?"

**RuntimeInstance** répond à : "L'app tourne-t-elle en ce moment, et où ?"

**DeploymentTarget** répond à : "Sur quelle infrastructure tourner ?"

---

## Modèle Prisma cible

```prisma
// Cible — non encore dans schema.prisma
model RuntimeInstance {
  id                String              @id @default(cuid())
  projectId         String
  project           Project             @relation(fields: [projectId], references: [id])
  runtimeTargetId   String?
  deploymentTargetId String?
  status            RuntimeInstanceStatus
  url               String?             // URL d'accès
  pid               Int?                // PID si local
  startedAt         DateTime?
  stoppedAt         DateTime?
  lastHealthCheck   DateTime?
  healthStatus      String?             // "ok" | "error" | null
  outDir            String?             // Répertoire de génération
  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt

  @@map("runtime_instances")
}

enum RuntimeInstanceStatus {
  PENDING     // Générée, pas encore démarrée
  STARTING    // En cours de démarrage
  RUNNING     // Opérationnelle
  STOPPING    // Arrêt en cours
  STOPPED     // Arrêtée proprement
  FAILED      // Erreur de démarrage ou crash
  UNKNOWN     // État inconnu (health check failed)
}
```

---

## Outils MCP planifiés (non implémentés)

| Tool | Description |
|------|-------------|
| `dtfs__create_runtime_instance` | Enregistrer une instance après génération |
| `dtfs__start_runtime_instance` | Démarrer une instance (docker compose up) |
| `dtfs__stop_runtime_instance` | Arrêter une instance |
| `dtfs__get_runtime_instance_status` | Health check |
| `dtfs__list_runtime_instances` | Lister les instances d'un projet |

---

## Situation V1

En V1, il n'y a pas de tracking des instances. Après `dtfs__generate_app`, l'utilisateur :

1. Copie ou utilise `outDir/` directement.
2. Démarre l'app manuellement (voir [[CLIENT_APP_START_STOP]]).
3. Le Control Plane ne sait pas si l'app tourne ou non.

Le seul indicateur disponible est le `.dtfs-manifest.json` dans `outDir/` qui confirme que la génération a eu lieu et liste les fichiers générés avec leurs hashes.

---

## Relation avec les autres concepts

```
Project (Control Plane)
  └── RuntimeTarget (stack config)
        └── RuntimeInstance (instance lancée)    ← non implémenté V1
              └── DeploymentTarget (où)          ← non implémenté V1
```
