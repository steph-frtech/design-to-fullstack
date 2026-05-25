# ADR-0008 — Compiler les contrats avant la génération de code

La génération de code est précédée obligatoirement par la compilation et la validation de trois contrats intermédiaires : SharedContract, BackendContract, FrontendContract.

Liens : [[ADR-0002-use-deltaspec]] · [[../04_Runtime_Contracts/RUNTIME_CONTRACTS_OVERVIEW]].

## Source of truth

`backend/src/lib/contracts/compile-{shared,backend,frontend}.ts` · `backend/src/lib/contracts/validate-contracts.ts`.

## AI usage

L'agent `dtfs-codegen-orchestrator` compile les contrats dans l'ordre shared→backend→frontend, valide leur cohérence, puis appelle `dtfs__generate_app`. Si `dtfs__validate_contracts` retourne `ok: false`, la génération est bloquée.

## Status

Accepted.

---

## Context

Générer du code directement depuis le modèle brut du Control Plane (Entités, Opérations, etc.) crée un couplage fort entre le schéma de persistance et la forme du code généré. Tout changement de modèle nécessite de modifier tous les emitters. De plus, la cohérence entre la couche backend et la couche frontend (ex : une route existe côté API mais pas de page côté web) ne peut pas être vérifiée.

## Decision

Avant toute génération, trois contrats sont compilés et persistés :

1. **SharedContract** — compilé en premier (ne dépend de rien) : entity DTOs, Zod schemas, operation types, AuthSession, error codes, events, typed API manifest.
2. **BackendContract** — compilé en second (dépend du SharedContract) : routes Hono, schemas de validation des inputs, auth config, policies, repositories.
3. **FrontendContract** — compilé en troisième (dépend du SharedContract) : pages Next.js, composants, forms, fields, actions, dataBindings.

`dtfs__validate_contracts` vérifie 7 règles de cohérence cross-contrats (ex : toute route backend a une page frontend, tout type de réponse est dans le SharedContract).

Si `ok: false`, la génération est **bloquée** par l'orchestrateur (mais pas encore par le code de `generateApp` lui-même — voir audit P1).

Ordre de compilation imposé :
```
dtfs__compile_shared_contract
→ dtfs__compile_backend_contract
→ dtfs__compile_frontend_contract
→ dtfs__validate_contracts  [gate bloquant dans l'orchestrateur]
→ dtfs__generate_app
```

## Consequences

**Positif :**
- Découplage entre le modèle de persistance et la forme du code généré.
- Validation de cohérence cross-couches avant génération.
- Les contrats sont persistés en base → replay/debug possible.
- Chaque emitter consomme un contrat typé, pas le spec brut.

**Négatif / Contrainte :**
- `validateContracts` n'est pas encore un gate bloquant dans `generateApp` lui-même (seulement dans l'orchestrateur) — backlog P1.
- `emit-prisma.ts` lit encore le spec brut (exception documentée).

## Alternatives considered

- **Génération directe depuis le spec** : plus simple mais couplage fort, pas de validation cross-couche.
- **OpenAPI spec comme intermédiaire** : redondant avec le BackendContract typé ; génération d'OpenAPI planifiée comme sortie additionnelle.

## Related documents

- [[ADR-0002-use-deltaspec]]
- [[ADR-0005-use-hono-for-generated-api]]
- [[../04_Runtime_Contracts/RUNTIME_CONTRACTS_OVERVIEW]]
- [[../10_Agents_MCP_Skills/AGENTS_OVERVIEW]]
