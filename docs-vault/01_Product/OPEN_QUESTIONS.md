# OPEN_QUESTIONS

Questions structurantes non encore tranchées pour la plateforme DTFS. Chacune a un impact sur des décisions d'architecture, de modèle de données ou de déploiement.

Liens : [[ASSUMPTIONS]] · [[PRODUCT_VISION]] · [[REQUIREMENTS]] · [[ARCHITECTURE_OVERVIEW]]

---

## Format

Chaque question suit le format :

> **Question** : énoncé clair de ce qui n'est pas décidé.
> **Impact** : ce qui change selon la réponse.
> **Dépendances** : fichiers ou modèles affectés.

---

## OQ-01 — Multi-tenant : comment isoler les projets de différents clients ?

**Question** : DTFS est-il un SaaS multi-tenant (un seul cluster pour tous les clients) ou est-il déployé en instance dédiée par client (single-tenant) ?

**Impact** :
- Multi-tenant : Row-Level Security sur les tables Control Plane, isolation par `projectId` + `ownerId`, facturation par usage.
- Single-tenant : déploiement Docker par client, pas de RLS complexe mais opérations lourdes.

**Dépendances** : `backend/prisma/schema.prisma` · politique d'authentification · `AUTH_MODEL`

---

## OQ-02 — Facturation : qui paye et pour quoi ?

**Question** : le modèle de facturation n'est pas défini. Paye-t-on par projet, par génération, par usage de l'app cliente, par siège utilisateur ?

**Impact** : intégration Stripe (déjà disponible via MCP Stripe), modèle `Subscription`, limites de quota sur les MCP tools.

**Dépendances** : `OPEN_QUESTIONS` · aucun modèle Prisma n'existe encore pour la facturation.

---

## OQ-03 — Runtime Node vs Bun : quel runtime pour le backend DTFS ?

**Question** : le Control Plane tourne actuellement sur Node (via `tsx`). La cible à moyen terme est-elle Bun (plus rapide, supporte nativement TypeScript) ?

**Impact** :
- Bun : supprime `tsx`, change les scripts `dev:backend`, simplifie le packaging.
- Bun incompatible avec certains packages Node natifs (à vérifier pour `@prisma/adapter-pg`).

**Dépendances** : `CLAUDE.md` · `backend/package.json` · `pnpm-workspace.yaml`

---

## OQ-04 — Object storage : où vont les Assets ?

**Question** : les `Asset` (fichiers uploadés dans les apps générées) doivent être stockés quelque part. S3 ? Cloudflare R2 ? Local filesystem (non scalable) ?

**Impact** :
- Choix du provider affecte `emit-asset.ts` (non encore écrit — P1 AUDIT_REPORT) et la configuration du Control Plane.
- L'`Asset` existe dans le schéma Prisma (`storage`, `mimeType`, `sizeBytes`, `contentHash`, `originalName`) mais le mapping codegen est absent.

**Dépendances** : `backend/prisma/schema.prisma:998-1019` · `docs/AUDIT_REPORT.md` P1

---

## OQ-05 — Versioning des apps générées : branches ou snapshots ?

**Question** : les apps générées sont-elles versionnées (une version par ChangeSet committé) ou régénérées intégralement à chaque fois ?

**Impact** :
- Versioning : nécessite un système de branches (DoltPostgres mentionné dans `ARCHITECTURE.md` comme cible V3), rollback natif de la DB générée.
- Snapshot : plus simple, suffisant pour V1/V2, rollback via re-génération depuis un ChangeSet précédent.

**Dépendances** : `docs/ARCHITECTURE.md` · `GeneratedArtifact` · `RuntimeTarget`

---

## OQ-06 — Déploiement de l'app générée : qui s'en charge ?

**Question** : DTFS génère le code. Qui déploie l'app cliente ? L'utilisateur manuellement ? Un pipeline CD intégré ? DTFS lui-même via Docker ?

**Impact** :
- CI/CD intégré : `DeploymentTarget` (modèle existant, placeholder) devient actif. Nécessite des credentials de déploiement.
- Manuel : DTFS s'arrête à la génération du code ; l'utilisateur déploie lui-même.

**Dépendances** : `DeploymentTarget` (schéma Prisma) · `generated-app/docker-compose.yml` (cible)

---

## Source of truth

`docs/AUDIT_REPORT.md` · `docs/ARCHITECTURE.md` · `backend/prisma/schema.prisma`

## AI usage

Un agent ne doit pas prendre de décision implicite sur ces questions. Si une action nécessite de trancher l'une d'elles (ex. : choisir S3 pour les assets), il doit surfacer la question avant d'agir.

## Status

documented
