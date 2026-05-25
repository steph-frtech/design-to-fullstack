---
description: Applique un DeltaSpec au Control Plane via un ChangeSet (Phase 7 — irréversible sans revert).
---

Flux complet : `begin_changeset` → `apply_delta_spec` (ou `apply_spec`) →
`commit_changeset`. Chaque étape demande une confirmation explicite.

## Cible

$ARGUMENTS

## Format attendu

`<projectId> <deltaSpecId>` — les deux sont obligatoires.

## Instructions

### Pre-flight (obligatoire)

1. Appeler `dtfs__validate_delta_spec(deltaSpecId)`. Si verdict `BLOCKED`,
   arrêter et demander à l'utilisateur de lancer `/dtfs:validate` pour
   corriger les erreurs.
2. Appeler `dtfs__explain_delta_spec(deltaSpecId)` et afficher l'explication
   à l'utilisateur.
3. Demander une **confirmation explicite** : "Voulez-vous appliquer ce
   DeltaSpec ? (oui/non)". Ne pas continuer sans réponse affirmative.

### Application

4. Appeler `dtfs__begin_changeset(projectId, message)` — message = résumé
   du DeltaSpec en une ligne.
5. Appeler `dtfs__apply_delta_spec(changeSetId, deltaSpecId)`.
6. Appeler `dtfs__commit_changeset(changeSetId)`.

### Post-apply

7. Reporter :
   - `changeSetId` committé
   - liste des entités / opérations / policies créées ou modifiées
   - "Pour annuler : `/dtfs:revert <changeSetId>`"

## Gate ChangeSet

Le serveur impose qu'un ChangeSet actif (`begin_changeset`) existe avant
tout `apply_spec`. Si ce gate n'est pas respecté, l'opération échoue côté
serveur (defense-in-depth aussi assurée par le hook `dtfs-guard-apply.sh`).
