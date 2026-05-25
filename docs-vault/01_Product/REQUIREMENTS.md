# REQUIREMENTS

Les exigences de la plateforme DTFS définissent les contraintes non-négociables que toute évolution doit respecter. Elles sont distinctes des requirements fonctionnels des apps générées (qui, eux, vivent dans les tables `Requirement` du Control Plane).

Liens : [[PRODUCT_VISION]] · [[PRODUCT_SPEC]] · [[ASSUMPTIONS]] · [[SEPARATION_OF_CONCERNS]] · [[SECURITY_MODEL]]

---

## Exigences plateforme

### REQ-01 — Déclarativité

**Énoncé** : toute l'app cible doit être décrite par des modèles déclaratifs dans le Control Plane (Entity, Resource, Operation, Policy, Screen, Form, Field, Action, DataBinding, AuthMethod…). Le LLM ne génère jamais de code ad hoc.

**Impact** : rend le spec inspectable, diffable, revertable. Permet la recompilation déterministe depuis le même état.

**Modèles concernés** : tous les 43 modèles du schéma Prisma Control Plane.

---

### REQ-02 — Traçabilité complète

**Énoncé** : chaque mutation du Control Plane produit une `Revision` liée à un `ChangeSet`. L'`AuditLog` enregistre toutes les actions apply/commit/revert/generate.

**Impact** : historique permanent, auditabilité légale, débogage facilité.

**Modèles concernés** : `ChangeSet` · `Revision` · `AuditLog`

**Implémentation** : `backend/src/lib/changeset-middleware.ts` enforce l'écriture dans un ChangeSet sur tout `POST/PUT/PATCH/DELETE` sous `/:id/*`.

---

### REQ-03 — Réversibilité

**Énoncé** : tout ChangeSet committé peut être inversé via `revert_changeset`. L'inversion produit elle-même un nouveau ChangeSet de type REVERT (jamais de suppression physique).

**Impact** : aucune décision de spec n'est définitive ; les erreurs sont récupérables.

**Modèles concernés** : `ChangeSet` · `Revision` · `backend/src/lib/revert.ts`

---

### REQ-04 — Séparation des bases de données

**Énoncé** : la base de données du Control Plane (schéma `dtfs`) ne contient aucune table métier des apps générées. La base de l'app cliente (schéma `gen_<slug>`) ne contient aucune table du Control Plane.

**Impact** : isolation, sécurité, scalabilité. Voir [[SEPARATION_OF_CONCERNS]] et [[DATA_OWNERSHIP]].

---

### REQ-05 — Sécurité des secrets

**Énoncé** : aucun secret (clé API, mot de passe, token) ne peut être stocké en clair dans un DeltaSpec ou dans le Control Plane. Seules les références (`secretRef:env:VAR`, `vault:`, `$ref:`) sont autorisées.

**Impact** : protection contre les leaks dans l'historique Git et les logs.

**Garde-fou** : `guardNoInlineSecrets` dans `backend/src/lib/governance/guardrails.ts` — implémenté et testé.

---

### REQ-06 — Gates de validation bloquantes

**Énoncé** : `validateDeltaSpec` doit être un gate bloquant avant tout apply. `validateContracts()` doit être un gate bloquant avant tout codegen.

**Impact** : empêche l'application de specs invalides et la génération de code incohérent.

**État actuel** : gates implémentés mais non encore câblés comme barrières dans `applyDeltaSpec` et `generateApp` (P0 AUDIT_REPORT). Le middleware changeset-required est actif.

---

### REQ-07 — Protection des fichiers manuels

**Énoncé** : un fichier généré modifié manuellement (marqué `protected`) ne peut pas être écrasé par une régénération.

**Impact** : le développeur peut customiser l'app générée sans risque de perte.

**État actuel** : `ManifestEntry.protected` codé en dur à `false` → non fonctionnel (P0 AUDIT_REPORT).

---

## Requirement / RequirementMapping (modèles Control Plane)

Les exigences fonctionnelles des apps générées vivent dans des tables dédiées :

```
Requirement {
  id           String
  projectId    String    FK Project
  statement    String    ex. "Users can create todo lists"
  kind         String    FUNCTIONAL | NON_FUNCTIONAL | SECURITY | ...
  priority     String    HIGH | MEDIUM | LOW
}

RequirementMapping {
  id             String
  requirementId  String   FK Requirement
  targetType     String   ex. "Operation" | "Resource" | "Entity"
  targetId       String   id du concept cible dans le Control Plane
}
```

La couverture des Requirements prioritaires est vérifiée par `coverage-gate` (`backend/src/lib/coverage-gate.ts`) — implémenté, non intégré au pipeline (P1 AUDIT_REPORT).

## Source of truth

`docs/GOVERNANCE.md` · `backend/src/lib/governance/guardrails.ts` · `backend/src/lib/changeset-middleware.ts` · `backend/prisma/schema.prisma`

## AI usage

Avant de proposer un changement d'architecture, un agent doit vérifier qu'il ne viole pas REQ-01 à REQ-07. REQ-06 et REQ-07 ont des implémentations partielles à compléter (voir AUDIT_REPORT P0).

## Status

partially implemented
