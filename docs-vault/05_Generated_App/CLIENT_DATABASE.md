# CLIENT_DATABASE

La base de données de l'application cliente est **strictement séparée** de la Control Plane DB du meta-platform DTFS. Elle contient les tables Better Auth, les données métier générées depuis les Entities Control Plane, les tables d'assets et les éventuelles tables supplémentaires. Elle est gérée par l'app cliente elle-même via Prisma migrations.

Liens : [[DATABASE_GENERATION]] · [[BETTER_AUTH_GENERATION]] · [[CLIENT_APP_DOCKER_RUNTIME]] · [[GENERATED_APP_OVERVIEW]]

---

## Source of truth

`docs/BETTER_AUTH_GENERATION.md` (tables Better Auth) · `backend/src/codegen/emit-prisma.ts`

---

## Séparation Control Plane vs Client App

| Base de données | Schéma | Contenu | Qui la gère |
|---|---|---|---|
| **Control Plane DB** | `dtfs` (ou défaut) | ProjectSpec, Entity, Screen, ChangeSet, RuntimeTarget, BackendContract… | DTFS meta-platform |
| **Client App DB** | `gen_<slug>` ou dédié | Données métier de l'app générée, sessions Better Auth | L'app cliente elle-même |

Aucun code de l'app générée ne doit accéder à la Control Plane DB. Aucun code du meta-platform ne doit accéder à la Client App DB.

---

## Tables Better Auth (générées automatiquement)

Présentes quand `BackendContract.auth.emailPassword = true` :

| Table | Rôle |
|---|---|
| `user` | Comptes utilisateurs (email, name, emailVerified…) |
| `session` | Sessions actives (token, expiresAt, userId) |
| `account` | Comptes OAuth ou API key liés à un user |
| `verification` | Codes de vérification email / reset password |

Ces tables sont gérées entièrement par Better Auth — ne jamais les modifier manuellement dans le schema.

---

## Tables métier (depuis Entities)

Chaque `Entity` Control Plane produit un modèle Prisma dans le schema de l'app cliente. Exemple :

```
Entity: Customer (attributes: id, email, name, createdAt)
  → model Customer { id String @id; email String @unique; name String; createdAt DateTime @default(now()) }
```

Les `EntityRelation` produisent les FKs et relations Prisma correspondantes.

---

## Tables d'assets (cible)

Si des `Asset` sont présents dans le BackendContract (non encore implémenté — AUDIT_REPORT P1), une table de métadonnées d'assets est ajoutée :

```prisma
model Asset {
  id           String  @id @default(cuid())
  projectId    String
  storage      String  // "local"|"s3"|"r2"
  originalName String
  mimeType     String
  sizeBytes    Int
  contentHash  String
  url          String?
  createdAt    DateTime @default(now())
}
```

---

## Connection (Prisma 7 — adapter-pg)

L'app cliente utilise `@prisma/adapter-pg` — il n'y a **pas de `url`** dans le bloc `datasource` du schema.prisma généré. La connexion est fournie au runtime via la variable d'environnement `DATABASE_URL` consommée par l'adaptateur.

```ts
// apps/api/src/db.ts
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
export const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
```

---

## Migrations de l'app cliente

Les migrations Prisma de l'app cliente sont générées avec `prisma migrate dev` dans l'environnement de développement et appliquées avec `prisma migrate deploy` en production (via le service `migrate` du docker-compose).

Le DTFS meta-platform n'applique jamais de migrations pour l'app cliente.

---

## AI usage

Toujours vérifier que `DATABASE_URL` dans l'app cliente pointe vers la Client App DB, jamais vers la Control Plane DB. Les deux bases doivent être sur des instances ou des schémas séparés.

## Status

`documented` — tables Better Auth et métier générées par `emit-prisma.ts` ; table Asset = cible (non implémentée — AUDIT_REPORT P1).
