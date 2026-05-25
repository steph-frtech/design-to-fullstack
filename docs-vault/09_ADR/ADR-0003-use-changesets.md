# ADR-0003 — Modifications traçables et réversibles via ChangeSet

Chaque apply de DeltaSpec est encapsulé dans un ChangeSet qui enregistre toutes les Revisions individuelles et peut être annulé intégralement ou champ par champ.

Liens : [[ADR-0002-use-deltaspec]] · [[../03_Control_Plane/CHANGESET_FLOW]].

## Source of truth

`backend/src/changesets.ts` + `backend/src/lib/revert.ts` + `backend/src/lib/spec-snapshot.ts`.

## AI usage

Les agents ouvrent un ChangeSet avant d'appliquer (`dtfs__begin_changeset`), appliquent, puis committent (`dtfs__commit_changeset`). En cas d'erreur : `dtfs__discard_changeset`. Pour annuler : `dtfs__revert_changeset`.

## Status

Accepted.

---

## Context

Un système de design génératif produit des erreurs fréquentes : un agent applique un DeltaSpec incomplet, un utilisateur change d'avis après coup, une migration partielle laisse le modèle dans un état incohérent. Sans mécanisme de revert, toute erreur est irréversible ou très coûteuse à corriger.

## Decision

Toute séquence de modifications est enveloppée dans un `ChangeSet` (analogie : une transaction de base de données, mais au niveau sémantique du domaine). Un ChangeSet :

- A un `status` parmi `OPEN`, `COMMITTED`, `DISCARDED`, `REVERTED`.
- Contient N `Revision` rows, une par objet modifié, avec les valeurs avant/après.
- Est créé via `dtfs__begin_changeset(projectId, message)`.
- Est finalisé via `dtfs__commit_changeset(changeSetId)` ou abandonné via `dtfs__discard_changeset`.
- Peut être annulé après commit via `dtfs__revert_changeset` — qui crée un nouveau ChangeSet REVERTED appliquant l'inverse de chaque Revision.

Le middleware `changeSetMiddleware` rejette tout POST/PUT/PATCH/DELETE sous `/:id/*` sans `changeSetId` actif.

Le hook `dtfs-guard-apply.sh` (PreToolUse) ajoute une couche de défense côté Claude Code.

## Consequences

**Positif :**
- Revert complet ou champ par champ (`dtfs__revert_field`).
- `dtfs__get_spec_at(projectId, atVersion)` permet de voir l'état du modèle à n'importe quel ChangeSet passé.
- Audit trail implicite : chaque ChangeSet a un `message` + `createdAt`.

**Négatif / Contrainte :**
- `applyDeltaSpec` n'est pas encore transactionnel (pas de `$transaction` Prisma) — si l'apply échoue à mi-parcours, les Revisions partielles restent en base. Mitigation : toujours `discard` en cas d'erreur.
- `getSpecAt` couvre Entity/Attribute/Operation mais pas encore les relations, politiques, écrans.

## Alternatives considered

- **Git pour le versionning** : inadapté au versionning d'objets structurés en base ; les conflits de merge sont sémantiquement ambigus pour un modèle de données.
- **Soft-delete + timestamps** : ne permet pas le revert d'une valeur de champ spécifique.
- **Event sourcing** : trop de complexité pour un usage mono-tenant de design-time.

## Related documents

- [[ADR-0002-use-deltaspec]]
- [[../03_Control_Plane/CHANGESET_FLOW]]
- [[../12_Operations/MIGRATIONS]]
