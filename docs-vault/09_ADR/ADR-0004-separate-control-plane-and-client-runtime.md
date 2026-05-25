# ADR-0004 — Séparer l'usine DTFS et les applications générées

La plateforme DTFS (Control Plane + harness) et les applications qu'elle génère s'exécutent dans des processus et bases de données totalement distincts.

Liens : [[ADR-0001-use-control-plane]] · [[../04_Runtime_Contracts/RUNTIME_TARGET]] · [[../12_Operations/CLIENT_APP_START_STOP]].

## Source of truth

`backend/src/codegen/codegen.ts` — `resolveSafeOutDir` bloque les écritures dans `/data/dev/design-to-fullstack`.

## AI usage

Les agents de codegen écrivent exclusivement dans `/tmp/...` ou `<project.localPath>/generated/`. Jamais dans le repo DTFS lui-même.

## Status

Accepted.

---

## Context

Un système de méta-programmation qui s'auto-modifie est extrêmement risqué : un bug de codegen peut écraser ses propres sources, rendre le système inutilisable et perdre des données. Il faut une séparation stricte entre l'usine et ce qu'elle produit.

De plus, les applications générées ont leurs propres exigences opérationnelles (base de données séparée, variables d'environnement distinctes, déploiement indépendant) qui ne doivent pas polluer le Control Plane.

## Decision

1. **Répertoires séparés.** Le codegen écrit dans un `outDir` qui est soit `/tmp/dtfs-<projectId>/` soit `<project.localPath>/generated/`. `resolveSafeOutDir` lève une erreur si le chemin cible est à l'intérieur du repo DTFS.

2. **Bases de données séparées.** Le Control Plane utilise la variable `DATABASE_URL` du `.env` racine. L'application générée dispose de sa propre `DATABASE_URL` dans son `.env` local (non partagé).

3. **Processus séparés.** Le serveur DTFS (`pnpm dev:backend` sur `:4002`) et l'application générée (port configurable) ne partagent pas de mémoire ni de connexions de base.

4. **RuntimeTarget.** La configuration de la stack cible (framework, ORM, auth, outputDir) est stockée dans le Control Plane mais n'est pas exécutée par lui — elle pilote uniquement le codegen.

## Consequences

**Positif :**
- Impossible de casser le Control Plane en générant du code.
- L'application générée peut être déployée indépendamment.
- Plusieurs projets peuvent coexister avec des stacks différentes.

**Négatif / Contrainte :**
- Le workflow de test de l'app générée est plus complexe (générer → builder → migrer → seed → tester).
- `runGeneratedTests` est actuellement un stub (toujours `skipped: true`).

## Alternatives considered

- **In-repo generation** : simple à démarrer, dangereux dès que le codegen a un bug.
- **Monorepo commun** : les dépendances croisées polluent les lockfiles et créent des conflits de versions.

## Related documents

- [[ADR-0001-use-control-plane]]
- [[../04_Runtime_Contracts/RUNTIME_TARGET]]
- [[../12_Operations/CLIENT_APP_START_STOP]]
- [[../12_Operations/RUNTIME_INSTANCES]]
