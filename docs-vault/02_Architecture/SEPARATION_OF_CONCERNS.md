# SEPARATION_OF_CONCERNS

Règle impérative : le Control Plane et l'app cliente générée sont deux systèmes **entièrement séparés**. Leurs bases de données ne se partagent aucune table. Leurs sessions d'authentification sont indépendantes. Mélanger les deux est une erreur d'architecture non récupérable.

Liens : [[ARCHITECTURE_OVERVIEW]] · [[CONTROL_PLANE]] · [[CLIENT_APP_RUNTIME]] · [[DATA_OWNERSHIP]] · [[SECURITY_MODEL]]

---

## La règle en une phrase

> **Aucune table métier de l'app cliente dans la base du Control Plane. Aucune table du Control Plane dans la base de l'app cliente.**

---

## Tableau de séparation

| Élément | Control Plane DB (`dtfs`) | Client App DB (`gen_<slug>`) |
|---|---|---|
| `Entity` (définition) | Oui — c'est le spec | Non |
| Tables métier générées (ex. `todo_lists`) | Non | Oui |
| `ChangeSet` · `Revision` | Oui | Non |
| `ProductSpec` · `ScreenSpec` | Oui | Non |
| `GeneratedArtifact` | Oui | Non |
| `AuditLog` | Oui | Non |
| `user` (Better Auth DTFS) | Oui — utilisateurs de la plateforme | Non |
| `user` (Better Auth app cliente) | Non | Oui — utilisateurs de l'app générée |
| `session` · `account` (DTFS) | Oui | Non |
| `session` · `account` (app cliente) | Non | Oui |
| `RuntimeTarget` · `BackendContract` | Oui | Non |
| `Operation` (définition) | Oui — c'est le spec | Non |
| Tables d'opérations exécutées | Non | Oui (si la logique le requiert) |
| Secrets de l'app générée | Non — jamais stockés en clair | Via variables d'environnement de l'app cliente |

---

## Pourquoi cette séparation est critique

### 1. Sécurité

Les credentials utilisateurs de l'app cliente (sessions Better Auth) ne doivent pas être accessibles par les opérations internes de DTFS. Une fuite de la base Control Plane ne doit pas exposer les données des utilisateurs finaux de l'app.

### 2. Isolation des défaillances

Une migration de la base Control Plane ne doit pas affecter l'app cliente en production. L'inverse aussi : une migration de schéma générée ne touche pas la base DTFS.

### 3. Multi-tenant et scalabilité

Si DTFS héberge N projets, chaque projet a son propre schéma `gen_<slug>`. Le Control Plane est partagé entre projets (isolé par `projectId`) mais les bases clientes sont indépendantes.

### 4. Réversibilité

Si l'app générée est supprimée (drop schéma `gen_<slug>`), le Control Plane conserve toutes les specs et peut régénérer l'app intégralement. La séparation garantit que la suppression de l'app ne perd rien.

---

## Ce que l'emitter `emit-auth.ts` doit respecter

`emit-auth.ts` génère le fichier `apps/api/src/auth.ts` dans l'app cliente. Ce fichier contient la configuration Better Auth **de l'app cliente**. Il est distinct de l'auth Better Auth du Control Plane lui-même.

- L'auth Better Auth générée utilise la **base de données cliente** (`gen_<slug>`).
- L'auth DTFS (accès à la plateforme) utilise la **base de données Control Plane** (`dtfs`).
- Ces deux instances Better Auth ne partagent ni tables ni secrets.

Référence : `docs/AUDIT_REPORT.md` ligne 84 — "Garde-fou Better Auth isolé : conforme".

---

## Violations à ne jamais commettre

- Créer une table `todo_lists` dans la migration du Control Plane.
- Stocker un `session_token` utilisateur final dans `ChangeSet.metadata`.
- Appeler `prisma.user.findMany()` (base Control Plane) depuis une route de l'app générée.
- Partager une variable `DATABASE_URL` entre le Control Plane et l'app cliente.
- Importer le client Prisma Control Plane (`backend/generated/prisma/`) dans le code de l'app générée.

---

## Source of truth

`docs/GOVERNANCE.md` · `backend/src/codegen/emit-auth.ts` · `backend/prisma/schema.prisma` · `docs/AUDIT_REPORT.md`

## AI usage

Avant tout changement de schéma ou de codegen, un agent doit vérifier qu'il ne crée pas de couplage entre les deux bases. Tout ajout de modèle Prisma dans `schema.prisma` doit être une donnée du Control Plane, pas une donnée d'une app cliente.

## Status

documented
