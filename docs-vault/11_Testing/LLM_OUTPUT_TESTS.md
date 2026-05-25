# LLM Output Tests

Tests de contrat sur les sorties LLM : les agents produisent du JSON qui doit être valide, Zod-valide, et respecter les invariants du domaine DTFS.

Liens : [[TEST_STRATEGY]] · [[GOLDEN_TESTS]] · [[SECURITY_TESTS]] · [[../10_Agents_MCP_Skills/SAFETY_RULES]].

## Source of truth

`backend/src/lib/contract/assertions.ts` · `backend/src/lib/governance/guardrails.ts`.

## AI usage

Ces tests définissent les propriétés que tout agent DTFS doit garantir sur ses sorties JSON avant de les persister via MCP. Les agents appliquent ces checks implicitement en utilisant les outils de validation (`dtfs__validate_delta_spec`, `dtfs__validate_product_spec`, etc.).

## Status

Tests implémentés : guardrails 2, 3, 4 (inline secrets, expr functions, delete confirmation). Contrats LLM golden : 2/6. Backlog P2 : 4 manquants.

---

## Propriétés contractuelles sur les sorties LLM

### P1 — JSON valide

Toute sortie d'agent est du JSON parseable. Les agents utilisent des outils MCP qui valident la structure avant persist — pas de JSON libre envoyé directement en base.

**Vérifié par :** Le parsing Zod dans tous les endpoints MCP (`mcp.ts`).

---

### P2 — Zod-valid

Le JSON produit doit passer le schéma Zod du type attendu.

| Type | Schema Zod |
|------|-----------|
| DeltaSpec | `deltaSpecSchema` (21 buckets) |
| ProductSpec | `productSpecSchema` (champs requis : title, description, targetUsers, goals, ...) |
| ScreenSpec | `screenSpecSchema` |
| PlatformSpecProposal | `proposalEnvelopeSchema` |
| BackendContract | `backendContractSchema` |
| SharedContract | `sharedContractSchema` |

**Vérifié par :** `dtfs__validate_delta_spec`, `dtfs__validate_product_spec`, `dtfs__validate_screen_spec`, `dtfs__validate_platform_proposal`, `dtfs__validate_contracts`.

---

### P3 — Pas de fonction Expr inconnue

Toute expression `{call: "..."}` dans un DeltaSpec doit référencer une des 8 fonctions du catalogue fermé : `lowercase`, `uppercase`, `trim`, `concat`, `length`, `now`, `uuid`, `randomToken`.

**Vérifié par :** `guardNoUnknownExprFunctions` (guardrail 4) — enforced et testé.

**Test :**
```typescript
// FAIL — fonction inventée par LLM
{ "call": "calculateTax", "args": [...] }

// PASS — fonction du catalogue
{ "call": "uuid", "args": [] }
```

---

### P4 — Pas d'Entity inexistante

Un DeltaSpec ne peut pas référencer une entité dans une opération ou politique si cette entité n'existe pas dans le spec courant (ni dans les `entities.create` du même DeltaSpec).

**Vérifié par :** `assertDeltaSpecContract` avec `existingEntityNames`.

---

### P5 — Pas de Requirement critique non couvert

Avant de générer, tous les Requirements de priorité HIGH ou CRITICAL doivent avoir un mapping. Les agents `dtfs-platform-mapper` et `dtfs-codegen-orchestrator` vérifient ce point via `dtfs__validate_requirement_coverage`.

**État :** Détection implémentée, non gate automatique (backlog P1).

---

### P6 — Pas de fichier manuel écrasé

Un codegen non-dryRun ne doit pas écraser un fichier marqué `protected: true` dans le manifest.

**État :** `protected` est codé en dur à `false` → non fonctionnel (P0). La détection V1 signale le problème sans bloquer.

---

### P7 — Pas de secret en clair

Aucune valeur de champ sensible (password, apiKey, token...) ne doit contenir une valeur littérale sans préfixe `secretRef:`, `env:`, `vault:` ou `$ref:`.

**Vérifié par :** `guardNoInlineSecrets` (guardrail 2) — enforced et testé.

---

## Assertions disponibles pour les tests LLM

```typescript
// Disponible dans backend/src/lib/contract/assertions.ts
assertDeltaSpecContract(deltaSpec, {
  existingEntityNames: string[],     // optionnel
  existingOperationNames: string[]   // optionnel
});

// Disponible dans backend/src/lib/governance/guardrails.ts
guardNoInlineSecrets(deltaSpec);
guardNoUnknownExprFunctions(deltaSpec);
guardDeleteRequiresValidation(deltaSpec, { confirmDeletes: false });
guardValidateBeforeApply(deltaSpec, ctx);
```

---

## Lacunes identifiées (golden tests LLM manquants)

| Étape LLM | Assertion manquante |
|-----------|---------------------|
| Prompt → ProductSpec | Zod-valid + tous champs requis présents |
| ProductSpec → ScreenSpec | Pas de Screen sans title ni route |
| SDD → Requirements | Chaque Requirement a un `acceptanceCriteria` non vide |
| Requirements → ProposalEnvelope | `confidenceScore` dans [0,1], pas de bucket vide si requirements existent |
