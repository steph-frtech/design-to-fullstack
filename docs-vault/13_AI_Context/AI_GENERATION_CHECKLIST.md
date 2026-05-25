# AI Generation Checklist — Avant de générer du code

Checklist à parcourir avant tout appel `generate_app` en mode non-dryRun, ou avant tout `apply_delta_spec`. Chaque item bloque ou avertit selon sa sévérité. Les items marqués **BLOCK** doivent tous être verts avant de procéder.

Liens : [[AI_RULES]] · [[AI_DO_NOT_BREAK]] · [[../03_Control_Plane/GOVERNANCE]]

---

## Phase 1 — Avant apply_delta_spec

### [BLOCK] Validate DeltaSpec OK
- Appeler `dtfs__run_governance_checks` (ou `dtfs__validate_delta_spec`) sur le DeltaSpec.
- Résultat attendu : `{ ok: true }`.
- Si `ok: false` : corriger les violations avant tout `apply_delta_spec`.
- Note : ce gate est un P0 non-enforced dans le code — l'appliquer manuellement (voir [[AI_RULES]] R02).

### [BLOCK] ChangeSet actif
- Vérifier qu'un `begin_changeset` a été appelé et que `changeSetId` est présent.
- Le hook `dtfs-guard-apply.sh` bloque l'appel si absent, mais vérifier manuellement.

### [BLOCK] Pas de secret en clair
- `guardNoInlineSecrets` doit passer. Aucune valeur `apiKey`, `password`, `token` en littéral.
- Utiliser la forme `secretRef:env:NOM_VAR`.

### [BLOCK] Pas de fonction Expr inventée
- Toutes les `{ call: "..." }` dans le DeltaSpec utilisent l'une des 8 fonctions autorisées.
- Liste : `lowercase`, `uppercase`, `trim`, `concat`, `length`, `now`, `uuid`, `randomToken`.

### [WARN] Coverage gate — Requirements prioritaires mappés
- `dtfs__check_coverage_gate` ne doit pas remonter de Requirements `MUST`/`SHOULD` non mappés.
- P1 non-enforced : vérifier manuellement via `dtfs__get_requirements` + `dtfs__get_requirement_mappings`.

### [WARN] Clarification gate — Pas de question critique ouverte
- Aucune `OpenQuestion` ou `Assumption` de statut `OPEN` pour ce projet.
- Vérifier via `dtfs__list_open_questions`. Si des questions OPEN existent, les résoudre d'abord.
- P1 non-enforced : ne pas contourner même si le code ne bloque pas encore.

---

## Phase 2 — Avant compile_*_contract

### [BLOCK] RuntimeTarget configuré
- `dtfs__get_runtime_target` retourne une config valide (stack versions, outputDir non vide).
- Si absent : appeler `/dtfs:set-runtime` ou `dtfs__set_runtime_target` en premier.

### [BLOCK] Spec appliquée et ChangeSet COMMITTED
- Le ChangeSet de la dernière modification est en statut `COMMITTED`, pas `OPEN`.
- Un ChangeSet `OPEN` non commité signifie que la spec en DB est en état intermédiaire.

---

## Phase 3 — Avant generate_app

### [BLOCK] Contrats compilés (les 3)
- `compile_shared_contract` → `compile_backend_contract` → `compile_frontend_contract` dans cet ordre.
- Chaque compilation doit retourner sans erreur.

### [BLOCK] validate_contracts OK
- `dtfs__validate_contracts` retourne `{ ok: true }` sur les 3 contrats.
- Si des erreurs : corriger le DeltaSpec ou les contrats avant de continuer.
- P1 non-enforced : appeler manuellement même si `generateApp` ne le fait pas automatiquement.

### [BLOCK] DryRun d'abord
- Appeler `generate_app(dryRun=true)` en premier. Lire le plan (N fichiers, N lignes).
- Valider le plan avec l'utilisateur avant `dryRun=false`.

### [BLOCK] trackArtifacts activé
- L'appel `generate_app(dryRun=false)` inclut `trackArtifacts: true`.
- Sans cela, `guardCodegenNeedsArtifactTracking` bloque l'appel.

### [WARN] Fichiers protégés respectés
- Vérifier les entrées `ManifestEntry.protected` du manifest précédent.
- Note P0 : `protected` est codé en dur à `false` dans le code actuel — identifier manuellement les fichiers modifiés à la main dans `outDir/` avant d'écraser.

---

## Phase 4 — Après generate_app

### [BLOCK] check-generated sans erreur bloquante
- `/dtfs:check-generated` (ou `dtfs-generated-code-reviewer`) doit passer sans violation critique.
- Vérifier : structure de répertoires, en-têtes `// Auto-generated`, imports TypeScript.

### [WARN] Tests generated-app
- `/dtfs:run-generated-tests` si disponible (stubs en P1 — ignorer si non implémenté).

---

## Résumé express (aide-mémoire)

```
1. governance_checks OK ?          → [BLOCK]
2. changeSetId présent ?           → [BLOCK]
3. pas de secrets en clair ?       → [BLOCK]
4. fonctions Expr valides ?        → [BLOCK]
5. questions critiques résolues ?  → [WARN]
6. RuntimeTarget configuré ?       → [BLOCK]
7. ChangeSet COMMITTED ?           → [BLOCK]
8. 3 contrats compilés ?           → [BLOCK]
9. validateContracts OK ?          → [BLOCK]
10. dryRun confirmé ?              → [BLOCK]
11. trackArtifacts: true ?         → [BLOCK]
12. fichiers manuels préservés ?   → [WARN]
13. check-generated OK ?           → [BLOCK]
```

## Source of truth

`docs/GOVERNANCE.md` · `backend/src/lib/governance/guardrails.ts` · `docs/HARNESS.md` §generate-app · `docs/AUDIT_REPORT.md`

## AI usage

Parcourir cette checklist séquentiellement. Ne pas passer à la phase suivante si un item BLOCK est rouge. Documenter les WARN non résolus dans un commentaire ou une OpenQuestion.

## Status

Stable — les items P0 (validate-before-apply, protected) sont des compensations manuelles jusqu'à correction du code.
