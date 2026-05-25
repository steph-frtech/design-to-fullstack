# Expr DSL — Langage d'expression

`Expr` est la syntaxe d'expression utilisée dans les champs `data`/`where`/`input` du Step DSL, dans les feuilles du Policy DSL, et partout où la plateforme a besoin de référencer des données ou calculer une valeur de façon déclarative.

**Liens** : [[OPERATION_DSL]] · [[POLICY_DSL]] · [[CONTROL_PLANE_MODEL]]

## Source of truth

`backend/src/lib/dsl/expr-ast.ts` · `backend/src/lib/dsl/expr-validate.ts` · `backend/src/lib/dsl/expr-eval.ts` · `backend/src/lib/dsl/expr-analyze.ts` · `docs/EXPR_DSL.md`

## AI usage

Toujours utiliser l'AST typé JSON (variant V2). Ne jamais inventer de fonction hors du catalogue des 8 fonctions fermées. Ne jamais utiliser de string JSONata libre dans les nouveaux steps ou policies — l'AST est obligatoire pour les nouveaux concepts. Les refs doivent commencer par `$.`.

## Status

V1 active — deux représentations coexistent : AST JSON typé (V2, recommandé pour les nouveaux concepts) et JSONata string (legacy V1, backward compat). La migration vers l'AST est en cours (dette listée P1 dans l'AUDIT_REPORT).

---

## Type Expr — 5 variantes

```typescript
type Expr =
  | { lit:  string | number | boolean | null }  // valeur littérale
  | { ref:  string }                             // lookup de chemin, ex. "$.input.title"
  | { call: string; args: Expr[] }               // appel de fonction
  | { obj:  Record<string, Expr> }              // construction d'objet
  | { arr:  Expr[] }                            // construction de tableau
```

Chaque variante est discriminée par sa clé structurelle unique. Le schéma Zod est récursif et valide tous les niveaux d'imbrication.

```typescript
import { exprSchema } from "backend/src/lib/dsl/expr-ast";
const result = exprSchema.safeParse(someJson);
```

---

## Roots — ce qui est en scope

Les refs doivent commencer par `$.` suivi d'une de ces racines :

| Root | Description |
|---|---|
| `$.input` | Input de l'Operation (le corps de requête validé) |
| `$.auth` | Contexte auth — `$.auth.user.id`, `$.auth.user.role`, … |
| `$.record` | Ligne DB courante (Policy scope ENTITY) |
| `$.records` | Tableau de lignes (operations list) |
| `$.system` | Helpers plateforme — `$.system.now`, etc. |
| `$.env` | Variables d'env allowlistées (lecture seule) |
| `$.params` | Path params de l'URL de requête |
| `$.query` | Query string params |
| `$.<alias>` | N'importe quel alias de step lié par un step antérieur via `as: "..."` |

La validation accepte des roots supplémentaires via `ctx.availableStepAliases`.

---

## Catalogue des fonctions — catalogue fermé (8 fonctions)

**Règle : toute fonction hors de ce catalogue est rejetée statiquement.**

| Nom | Arité | Pure | Type retour | Description |
|---|---|---|---|---|
| `lowercase` | 1 | oui | string | Met en minuscules |
| `uppercase` | 1 | oui | string | Met en majuscules |
| `trim` | 1 | oui | string | Supprime les espaces en début/fin |
| `concat` | variadique (≥1) | oui | string | Concatène plusieurs valeurs en strings |
| `length` | 1 | oui | number | Longueur d'une string ou d'un tableau |
| `now` | 0 | non | string | Timestamp ISO 8601 au moment de l'évaluation |
| `uuid` | 0 | non | string | `crypto.randomUUID()` |
| `randomToken` | 0 | non | string | 16 bytes hex via `crypto.randomBytes` |

`concat` est variadique : arité `-1` signifie qu'il accepte ≥ 1 argument.

---

## Exemples

### Littéral

```json
{ "lit": "hello world" }
{ "lit": 42 }
{ "lit": true }
{ "lit": null }
```

### Référence

```json
{ "ref": "$.input.title" }
{ "ref": "$.auth.user.id" }
{ "ref": "$.myStep.result.id" }
```

### Appel de fonction

```json
{ "call": "lowercase", "args": [{ "ref": "$.input.email" }] }
```

```json
{
  "call": "concat",
  "args": [
    { "lit": "Hello, " },
    { "ref": "$.auth.user.name" },
    { "lit": "!" }
  ]
}
```

### Construction d'objet

```json
{
  "obj": {
    "title":     { "call": "trim", "args": [{ "ref": "$.input.title" }] },
    "ownerId":   { "ref": "$.auth.user.id" },
    "createdAt": { "call": "now", "args": [] }
  }
}
```

### Appel imbriqué

```json
{
  "call": "concat",
  "args": [
    { "ref": "$.input.firstName" },
    { "lit": " " },
    { "call": "uppercase", "args": [{ "ref": "$.input.lastName" }] }
  ]
}
```

### Construction de tableau

```json
{
  "arr": [
    { "lit": "admin" },
    { "lit": "editor" }
  ]
}
```

---

## Surface API

### Endpoints HTTP

```
POST /api/projects/:id/expr/validate
  body: { expr: Expr, stepAliases?: string[] }
  → { ok: boolean, errors: { path, code, message }[] }

POST /api/projects/:id/expr/eval
  body: { expr: Expr, scope: object }
  → { value: unknown } | { error: string } (400)

POST /api/projects/:id/expr/analyze
  body: { expr: Expr }
  → { refs: string[], calls: string[], inferredType: string }
```

### MCP Tools

| Tool | Description |
|---|---|
| `dtfs__validate_expr` | Valide l'AST Expr (roots, arité, fonctions connues) |
| `dtfs__eval_expr` | Évalue contre un scope fourni |
| `dtfs__analyze_expr` | Collecte refs, calls, infère le type |

### Fonctions de bibliothèque

```typescript
import { validateExpr }     from "backend/src/lib/dsl/expr-validate";
import { evalExpr }         from "backend/src/lib/dsl/expr-eval";
import { collectExprRefs, collectExprCalls, inferExprType }
  from "backend/src/lib/dsl/expr-analyze";
```

---

## Validation statique

`validateExpr(expr, ctx?)` vérifie :

- Parse Zod récursif.
- `ref` paths commencent par `$.`.
- La racine de `ref` est dans les roots connus (`input`, `auth`, `record`, etc.) ou dans `ctx.availableStepAliases`.
- `call.call` est dans le catalogue des 8 fonctions — les fonctions inconnues sont rejetées (`unknown_function`).
- Arité des appels : `concat` ≥ 1, les autres = arity exacte.

Retourne `{ ok: boolean; errors: { path, code, message }[] }`.

---

## Cohabitation avec JSONata (état de migration)

La pile legacy `evalExpr(src: string, ctx)` dans `expr.ts` (wrappant JSONata) est toujours exportée et utilisée par le compilateur Policy et les operations V1 existantes. Elle n'est pas supprimée.

Le nouvel AST typé vit dans `expr-ast.ts`, `expr-validate.ts`, `expr-eval.ts`, `expr-analyze.ts`. Les nouveaux steps et les concepts LLM-authored doivent utiliser l'AST.

**Migration path par step** :
1. Identifier les strings JSONata dans `body`/`steps`.
2. Réécrire chaque string comme un noeud `Expr` typé.
3. Utiliser `validateExpr` pour linter au moment de l'authoring.
4. Le runtime Step appelle `evalExpr(expr, scope)` de `expr-eval.ts`.

Il n'y a pas de deadline de migration forcée en V1. Les deux formes coexistent. La suppression de `jsonata` + `expr.ts`/`policy.ts` legacy est listée P1 dans l'AUDIT_REPORT.
