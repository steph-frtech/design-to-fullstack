# ADR-0010 — OpenAPI / JSON Schema / Zod comme couche de contrat

La validation des structures de données dans DTFS repose sur Zod comme source de vérité des types, avec JSON Schema comme format d'échange et OpenAPI comme cible de documentation.

Liens : [[ADR-0008-use-contract-compilation-before-codegen]] · [[../04_Runtime_Contracts/SHARED_CONTRACT]].

## Source of truth

`backend/src/lib/dsl/delta-spec.ts` (Zod schemas) · `backend/src/lib/contracts/compile-shared.ts` (Zod→JSON Schema).

## AI usage

Les agents valident leurs sorties avec les schemas Zod avant de les persister. Le `SharedContract` exporte des Zod schemas pour chaque entité, consommables par le frontend généré et les tests de contrat LLM.

## Status

Accepted.

---

## Context

Un pipeline de génération de code qui implique des LLMs a besoin d'une couche de validation stricte : les LLMs produisent des JSON qui peuvent avoir des champs manquants, des types incorrects ou des références invalides. Sans validation programmatique, les erreurs se propagent jusqu'à la génération de code.

Par ailleurs, le `FrontendContract` et les tests de contrat ont besoin de schemas JSON portables (pas des types TypeScript compilés).

## Decision

1. **Zod** est la librairie de validation principale :
   - Tous les inputs MCP sont validés par Zod (`backend/src/mcp.ts`).
   - Le `deltaSpecSchema` est le schema Zod canonique du DeltaSpec.
   - Les contrats compilés (BackendContract, FrontendContract, SharedContract) sont des objets TypeScript typés par des interfaces Zod.

2. **JSON Schema** est le format d'export pour l'interopérabilité :
   - Le `SharedContract` exporte un Zod schema par entité, convertible en JSON Schema via `zod-to-json-schema`.
   - Les inputs/outputs des opérations sont stockés en JSON Schema dans le Control Plane.

3. **OpenAPI** est la cible de documentation (planifiée, non encore implémentée) :
   - Le `BackendContract` contient les routes, schemas et paramètres nécessaires pour générer un fichier `openapi.yaml`.
   - La génération OpenAPI est prévue en Phase 28+ comme sortie additionnelle.

4. **Expr AST** (non JSONata) pour les expressions de politique et d'opération : catalogue fermé de 8 fonctions, rejet strict des fonctions inconnues (guardrail `guardNoUnknownExprFunctions`).

## Consequences

**Positif :**
- Erreurs de validation détectées avant tout persist en base.
- Tests de contrat LLM possibles (asserter que la sortie d'un LLM est Zod-valide).
- JSON Schema exportable pour les formulaires frontend générés.

**Négatif / Contrainte :**
- Dette JSONata : l'ancien `expr.ts` + `policy.ts` cohabitent encore avec l'AST Zod (backlog P1).
- OpenAPI non encore généré — documentation API manuelle uniquement via `docs/HTTP_API.md`.

## Alternatives considered

- **TypeBox** : excellent JSON Schema natif, mais moins d'écosystème que Zod pour la validation runtime.
- **io-ts** : verbeux, moins intuitif.
- **JSONata libre** : rejeté car permet des expressions arbitraires non validables → risque de prompt injection.

## Related documents

- [[ADR-0002-use-deltaspec]]
- [[ADR-0008-use-contract-compilation-before-codegen]]
- [[../04_Runtime_Contracts/SHARED_CONTRACT]]
- [[../11_Testing/CONTRACT_TESTS]]
