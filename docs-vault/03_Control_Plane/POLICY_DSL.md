# Policy DSL

Les Policies autorisent qui peut faire quoi. Un `Policy.rule` est un **arbre d'expression récursif** (JSON AST) qui se compile vers trois cibles : évaluateur in-process, clause where Prisma, et (V2) Postgres RLS.

**Liens** : [[OPERATION_DSL]] · [[EXPR_DSL]] · [[CONTROL_PLANE_MODEL]] · [[DELTA_SPEC]]

## Source of truth

`backend/src/lib/dsl/policy-dsl.ts` · `backend/src/lib/dsl/policy-validate.ts` · `backend/src/lib/dsl/policy-eval.ts` · `docs/POLICY_DSL.md`

## AI usage

Utiliser uniquement les 12 opérateurs du catalogue fermé. Ne pas écrire de JS ou de logique impérative — les Policies sont pures. Les feuilles Expr suivent les mêmes contraintes que le Step DSL (voir [[EXPR_DSL]]). Pour les checks cross-entity, utiliser un step `read` dans l'Operation plutôt qu'une Policy.

## Status

V1 active — évaluateur in-process et clause where Prisma (partielle). Compilation RLS Postgres = V2. La migration de l'ancienne pile JSONata (`policy.ts` legacy) vers l'AST est listée P1 dans l'AUDIT_REPORT.

---

## Type PolicyRule — 12 opérateurs

```typescript
type PolicyRule =
  | { all:     PolicyRule[] }         // ET logique — tableau non vide
  | { any:     PolicyRule[] }         // OU logique — tableau non vide
  | { not:     PolicyRule }           // NON logique
  | { eq:      [Expr, Expr] }         // égalité stricte (===)
  | { neq:     [Expr, Expr] }         // inégalité stricte (!==)
  | { in:      [Expr, Expr] }         // gauche ∈ droite (droite = arr Expr)
  | { gt:      [Expr, Expr] }         // gauche > droite
  | { gte:     [Expr, Expr] }         // gauche >= droite
  | { lt:      [Expr, Expr] }         // gauche < droite
  | { lte:     [Expr, Expr] }         // gauche <= droite
  | { exists:  Expr }                 // valeur non null/undefined
  | { matches: [Expr, string] }       // test regex — le pattern est un string littéral
```

`POLICY_RULE_OPS = ["all","any","not","eq","neq","in","gt","gte","lt","lte","exists","matches"]`

---

## Référence des opérateurs

| Opérateur | Shape | Sémantique |
|---|---|---|
| `all` | `{ all: PolicyRule[] }` | Toutes les règles enfant doivent passer (AND). Non vide. |
| `any` | `{ any: PolicyRule[] }` | Au moins une doit passer (OR). Non vide. |
| `not` | `{ not: PolicyRule }` | Nie la règle enfant. |
| `eq` | `{ eq: [Expr, Expr] }` | Égalité stricte (`===`). |
| `neq` | `{ neq: [Expr, Expr] }` | Inégalité stricte (`!==`). |
| `in` | `{ in: [Expr, Expr] }` | Valeur gauche incluse dans le tableau droit. |
| `gt` | `{ gt: [Expr, Expr] }` | Gauche > droite (comparaison numérique). |
| `gte` | `{ gte: [Expr, Expr] }` | Gauche >= droite. |
| `lt` | `{ lt: [Expr, Expr] }` | Gauche < droite. |
| `lte` | `{ lte: [Expr, Expr] }` | Gauche <= droite. |
| `exists` | `{ exists: Expr }` | Expr évalue vers non-null/non-undefined. |
| `matches` | `{ matches: [Expr, string] }` | `new RegExp(pattern).test(value)`. |

---

## Feuilles Expr

Les règles Policy utilisent le même AST `Expr` que les steps Operation :

| Forme | Shape | Exemple |
|---|---|---|
| `lit` | `{ "lit": string\|number\|boolean\|null }` | `{ "lit": "admin" }` |
| `ref` | `{ "ref": "$.root.path" }` | `{ "ref": "$.auth.userId" }` |
| `call` | `{ "call": "fn", "args": Expr[] }` | `{ "call": "lowercase", "args": [...] }` |
| `obj` | `{ "obj": Record<string, Expr> }` | peu courant dans les policies |
| `arr` | `{ "arr": Expr[] }` | `{ "arr": [{ "lit": "a" }] }` |

Roots disponibles : `input`, `auth`, `record`, `records`, `system`, `env`, `params`, `query`, plus les step aliases depuis `as` quand évalué dans une Operation.

---

## Scopes de Policy

| Scope | S'applique à |
|---|---|
| `OPERATION` | Un appel `Operation` spécifique (champ : `operationId`) |
| `RESOURCE` | Toutes les ops d'une Resource (champ : `resourceId`) |
| `ENTITY` | Accès au niveau ligne sur une Entity (champ : `entityId`) |
| `FIELD` | Exclure/masquer un champ d'une Entity (`entityId` + `fieldName`) |

L'`effect` d'une Policy est `ALLOW` ou `DENY`. Plusieurs policies sur la même cible se composent : TOUTES doivent ALLOW, n'importe quel DENY bloque.

---

## Exemples

### `authenticated-only` — toute personne connectée

```json
{ "exists": { "ref": "$.auth.userId" } }
```

### `owner-only` — propriétaire de la ligne = utilisateur courant

```json
{
  "all": [
    { "exists": { "ref": "$.auth.userId" } },
    { "eq": [{ "ref": "$.auth.userId" }, { "ref": "$.record.ownerId" }] }
  ]
}
```

### `admin-or-owner` — composite avec `any`

```json
{
  "any": [
    { "eq": [{ "ref": "$.auth.role" }, { "lit": "admin" }] },
    { "eq": [{ "ref": "$.auth.userId" }, { "ref": "$.record.ownerId" }] }
  ]
}
```

### `email-format` — validation regex

```json
{
  "matches": [{ "ref": "$.input.email" }, "^[^@]+@[^@]+\\.[^@]+$"]
}
```

### `adult-only` — comparaison numérique

```json
{ "gte": [{ "ref": "$.auth.age" }, { "lit": 18 }] }
```

### `role-in-set` — rôle dans un ensemble

```json
{
  "in": [
    { "ref": "$.auth.role" },
    { "arr": [{ "lit": "admin" }, { "lit": "finance" }] }
  ]
}
```

---

## Cibles de compilation

### Cible 1 — évaluateur in-process (V1, toujours actif)

`evalPolicyRule(rule, scope) → boolean`. Parcourt l'arbre récursivement, évalue les feuilles Expr contre le scope. Fonction pure, pas d'I/O. Utilisé par le middleware avant chaque invocation d'Operation.

### Cible 2 — clause where Prisma (V1, partielle)

Pour les Policies `scope=ENTITY` sur les opérations list/read d'une Resource, la règle se compile en filtre Prisma where injecté à la query :

```typescript
// Policy: eq($.record.ownerId, $.auth.userId)
// Compilé :
{ where: { ownerId: { equals: ctx.auth.userId } } }
```

Restriction : les feuilles doivent être des refs `$.record.<field>` (gauche) ou `$.auth.*`/`$.system.*`/literal (droite). Les appels de fonction repoussent la règle vers le post-filtrage runtime-only.

### Cible 3 — Postgres RLS (V2)

```sql
CREATE POLICY is_todo_list_owner
  ON dtfs."TodoList"
  USING ("ownerId" = current_setting('app.user_id', true));
```

Défense en profondeur : le RLS tient même si le code applicatif est contourné.

---

## Ce que Policy ne peut PAS faire

- **Lectures cross-entity** ("l'utilisateur peut accéder si il appartient à l'équipe") — nécessite un step `read`, pas supporté dans une règle policy. Contournement : embarquer la FK nécessaire directement sur la ligne.
- **Appels externes** — les Policies sont pures. Pour un ACL externe, cacher le résultat en DB et le référencer via `$.record.*`.
- **Checks avec état** (rate limiting) — V1.x ajoutera un guard dédié.

---

## Validation statique

### `validatePolicyRule(rule, ctx?)`

Source : `backend/src/lib/dsl/policy-validate.ts`

```typescript
type PolicyValidateCtx = {
  availableStepAliases?: string[];  // passé à validateExpr
}
```

Vérifications :
- Parse Zod récursif de l'arbre complet.
- Tous les noeuds `Expr` validés avec `validateExpr` (ref roots, arité des calls).
- Tableaux `all` et `any` doivent être non vides (`empty_combinator`).
- `matches[1]` pattern validé comme `RegExp` syntaxiquement valide (capture `SyntaxError`).

Retourne `{ ok: boolean; errors: { path, code, message }[] }`.

---

## MCP Tools

| Tool | Description |
|---|---|
| `dtfs__validate_policy_rule` | Valide un arbre PolicyRule (Zod + Expr + regex) |
| `dtfs__list_policy_rule_ops` | Liste les 12 opérateurs PolicyRule |

## Endpoints HTTP

```
GET  /api/projects/:id/operation-dsl/policy-ops       → { ops }
POST /api/projects/:id/operation-dsl/validate-policy  { rule } → { ok, errors }
```
