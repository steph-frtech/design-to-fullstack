# ADR-0002 — Toute modification passe par DeltaSpec

Aucun agent, aucun outil, aucun endpoint HTTP ne modifie le Control Plane directement. Toute modification doit transiter par un `DeltaSpec` validé puis appliqué via un ChangeSet.

Liens : [[ADR-0001-use-control-plane]] · [[ADR-0003-use-changesets]] · [[../03_Control_Plane/DELTASPEC]].

## Source of truth

`backend/src/lib/dsl/delta-spec.ts` — schéma Zod canonique `deltaSpecSchema`.

## AI usage

Les agents produisent un DeltaSpec (objet JSON), appellent `dtfs__validate_delta_spec` puis `dtfs__apply_spec`. Ils ne font jamais de mutation directe via `prisma.entity.create` ou équivalent.

## Status

Accepted.

---

## Context

Sans format canonique de mutation, chaque agent peut modifier le Control Plane de façon incompatible : un agent crée une entité sans attributs, un autre l'écrase silencieusement, un troisième oublie de créer la politique associée. Il n'existe pas de point unique de validation, de traçabilité ou de revert.

## Decision

Toute modification du Control Plane passe par un `DeltaSpec` — un document JSON structuré décrivant ce qui doit être créé, mis à jour ou supprimé. Le format est typé via Zod en 21 buckets (`entities`, `attributes`, `relations`, `resources`, `operations`, `policies`, `screens`, `components`, `forms`, `fields`, `actions`, `dataBindings`, `workflows`, `triggers`, `integrations`, `assets`, `authMethods`, `productSpecs`, `screenSpecs`, `requirements`, `testScenarios`).

Chaque bucket suit la forme `{ create?, update?, delete? }`.

Le pipeline obligatoire est :
```
DeltaSpec → dtfs__validate_delta_spec → dtfs__apply_spec → ChangeSet COMMITTED
```

Les endpoints HTTP `POST /:id/apply` et `POST /:id/delta-spec/apply` font passer le DeltaSpec par les 7 guardrails de gouvernance avant tout apply.

## Consequences

**Positif :**
- Point unique de validation (structural + cross-ref checks).
- Revert possible : chaque apply génère des Revisions qui peuvent être annulées.
- Audit trail automatique sur chaque apply.
- Les agents ne peuvent pas contourner la validation.

**Négatif / Contrainte :**
- 9 buckets sur 21 ont des apply `not_implemented_yet` (workflows, authMethods, assets, components, forms, fields, actions, dataBindings, testScenarios) — ils passent en validation mais échouent silencieusement à l'apply.
- Le DeltaSpec n'est jamais stocké tel quel en base (runtime-only) ; il est matérialisé en Revisions.

## Alternatives considered

- **CRUD direct via API REST** : pas de validation croisée, pas de revert, chaque agent doit gérer ses propres erreurs.
- **Event sourcing classique** : trop lourd pour un système de design-time mono-tenant.
- **Patch JSON (RFC 6902)** : pas de sémantique domaine (on ne sait pas "pourquoi" un champ a changé).

## Related documents

- [[ADR-0001-use-control-plane]]
- [[ADR-0003-use-changesets]]
- [[../03_Control_Plane/DELTASPEC]]
- [[../09_ADR/ADR-0008-use-contract-compilation-before-codegen]]
