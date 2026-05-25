---
description: Annule un ChangeSet commité ou revient à un champ individuel (revert).
---

Appelle `dtfs__revert_changeset` pour annuler un ChangeSet entier, ou
`dtfs__revert_field` pour restaurer un champ précis à sa valeur antérieure.

## Cible

$ARGUMENTS

## Format attendu

- `<changeSetId>` — revert complet du ChangeSet
- `<changeSetId> field:<targetType>/<targetId>/<fieldPath>` — revert d'un seul champ

## Instructions

1. Identifier le scope depuis `$ARGUMENTS`.
2. Appeler `dtfs__describe_changeset(changeSetId)` et afficher le résumé du
   ChangeSet (date, message, opérations appliquées).
3. Demander une **confirmation explicite** avant de réverter :
   "Confirmer l'annulation de ce ChangeSet ? (oui/non)".
4. Selon le scope :
   - ChangeSet complet → `dtfs__revert_changeset(changeSetId)`
   - Champ individuel → `dtfs__revert_field(changeSetId, targetType, targetId, fieldPath)`
5. Reporter :
   - statut du revert (`REVERTED` / erreur)
   - liste des éléments restaurés
   - `changeSetId` de compensation si créé automatiquement par le serveur

## Notes

- Un ChangeSet en statut `OPEN` (non commité) peut être abandonné sans
  revert en appelant `dtfs__discard_changeset`.
- Si le ChangeSet est déjà `REVERTED`, l'opération échouera : reporter
  l'erreur sans retry automatique.
