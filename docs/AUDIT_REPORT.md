# Rapport d'audit DTFS — conformité architecture (lecture seule)

> Audit read-only du 2026-05-25. Aucun fichier du projet modifié. Méthode : orchestrateur,
> 6 work-packages parallèles avec preuves concrètes (chemins + lignes). Légende :
> ✅ conforme · ⚠️ incomplet · ❌ manquant · 🔧 correction · Priorité P0/P1/P2.

---

## Résumé exécutif

**Score global d'avancement : ~78 %** — l'architecture cible est **structurellement en place et câblée de bout en bout** ; les manques portent sur l'**enforcement des garde-fous** et la **complétude réelle du codegen** (beaucoup de stubs).

**Ce qui est solide (le squelette est réel, pas du vaporware)**
- **Modèle de données** : 43/43 modèles cibles présents ; `prisma validate` OK ; 0 migration pending ; les 14 migrations appliquées (incl. phase_10 + control_plane_v1_3).
- **DSLs** : Expr AST typé (5 variantes, catalogue fermé de 8 fonctions, roots validées), Operation DSL (10 steps), Policy DSL (12 ops) — tout passe par Expr, pas de string JSONata libre dans les nouveaux DSL.
- **DeltaSpec/ChangeSet** : format canonique (21 buckets create/update/delete), validate/apply/explain/diff présents, middleware qui force le ChangeSet sur toute écriture projet.
- **Harness** : 102 MCP tools enregistrés (39/39 de la liste cible), 19/19 agents, 20/20 slash commands, RuntimeTarget + 3 contrats compilables.
- **Tests** : 330 verts ; 9/9 catégories déterministes couvertes.

**Ce qui est fragile (présent mais pas tenu)**
- **Garde-fous non *enforced*** : `validateDeltaSpec` avant apply, `validateContracts` avant génération, clarification-gate, coverage-gate — tous **implémentés mais disponibles seulement comme outils séparés**, pas comme barrières dans le chemin d'exécution (`apply_delta_spec` / `generate_app` ne les appellent pas).
- **Protection des fichiers manuels non fonctionnelle** : `ManifestEntry.protected` est codé en dur à `false` → la détection « ne pas écraser un fichier manuel » ne se déclenche jamais.
- **Codegen frontend = stubs** : `compileFrontendContract` produit forms/fields/actions/dataBindings, mais `emit-next.ts` ne les consomme pas (pages quasi vides). Middlewares de policy backend = stubs pass-through.

**Ce qui manque**
- Mapping **Asset** totalement absent des contrats et emitters (doc seulement).
- Mapping **Theme/Translation** absent.
- 4 champs sur `GeneratedArtifact` (`ownership`, `protected`, `generatedFrom`, `runtimeTargetId`).
- `docs/HARNESS_DEV.md`.
- Dette **JSONata** (legacy `expr.ts` + `policy.ts`) encore référencée.

**Risque principal**
> Le système *donne l'apparence* d'un pipeline gouverné (les guards existent, les tests passent), mais à l'exécution réelle un agent peut **appliquer un DeltaSpec non validé**, **générer sans contrats valides** et **écraser un fichier manuel** — les trois impératifs §18 ne sont pas barrés dans le code. C'est un risque de *fausse confiance*, plus dangereux qu'un manque visible.

---

## Tableau de conformité

| Domaine | Statut | Fichiers concernés | Commentaire | Prio | Correction recommandée |
|---|---|---|---|---|---|
| Docs (20 fichiers) | ⚠️ | `docs/*.md` | 19/20 présents ; `HARNESS_DEV.md` absent | P2 | Créer ou retirer de la liste de référence |
| Flux cible documenté | ⚠️ | `docs/EXECUTION_FLOW.md:241-258` | `PlatformSpecProposal` absent du Full Chain ; noms `generate*` jamais dans la doc (docs parlent `emit-*`) | P1 | Insérer PlatformSpecProposal ; aligner nomenclature generate*/emit* |
| Schéma Prisma (modèles) | ✅ | `backend/prisma/schema.prisma` | 43/43 cibles + 9 extra ; DeltaSpec = runtime-only (voulu) | — | — |
| `OperationKind` | ⚠️ | `schema.prisma:565`, `delta-spec.ts:161` | `WORKFLOW` est une valeur **active** de l'enum (viole « QUERY\|COMMAND only ») | P1 | Retirer WORKFLOW de l'enum, ou guard applicatif de rejet |
| `AuthMethodKind` | ⚠️ | `schema.prisma:1038-1047` | Doublon `APIKEY` + `API_KEY` ; le Zod DeltaSpec ne connaît que `APIKEY` | P1 | Choisir un nom canonique, migrer, aligner Zod |
| `Asset` (champs) | ✅ | `schema.prisma:998-1019` | storage/mimeType/sizeBytes/contentHash/originalName présents | — | — |
| `GeneratedArtifact` (champs) | ⚠️ | `schema.prisma:1237-1259` | manquent `ownership`, `protected`, `generatedFrom`, `runtimeTargetId` (5/9) | P1 | Migration additive |
| `RuntimeTarget` + 3 Contracts | ✅ | `schema.prisma:1385-1470` | modèles persistables présents | — | — |
| DeltaSpec canonique | ✅ | `lib/dsl/delta-spec.ts`, `delta-spec-*.ts` | 21 buckets ; validate/apply/explain/compile + diffChangeSets | — | — |
| DeltaSpec apply (couverture) | ⚠️ | `lib/delta-spec-apply.ts:447-511` | 9/21 buckets `not_implemented_yet` (workflows, authMethods, assets, components, forms, fields, actions, dataBindings, testScenarios) ; non transactionnel | P1 | Implémenter buckets manquants ; `$transaction` ou statut FAILED |
| Expr DSL | ✅ | `lib/dsl/expr-ast.ts`, `expr-validate.ts`, `expr-eval.ts`, `expr-analyze.ts` | 5 variantes, 8 fns fermées, 8 roots, rejet strict des fns inconnues | — | — |
| Operation / Policy DSL | ✅ | `lib/dsl/operation-dsl.ts`, `policy-dsl.ts`, `policy-eval.ts` | 10 steps, 12 ops, tout via Expr ; evalPolicyRule présent | — | — |
| Dette JSONata | ⚠️ | `lib/dsl/expr.ts`, `policy.ts`, ref. depuis `policy-eval.ts:80`, `package.json:35` | ancienne pile JSONata cohabite avec l'AST ; `evalPolicy` legacy accessible | P1 | Finir migration, retirer `jsonata` + legacy, ou isoler explicitement |
| ChangeSet / Revision | ✅ | `changesets.ts`, `lib/revert.ts`, `lib/spec-snapshot.ts`, `lib/changeset-diff.ts` | begin/commit/discard/revert/revertField/getSpecAt/diff présents | — | — |
| `apply_spec` transactionnel | ⚠️ | `lib/delta-spec-apply.ts:1-8,554-561` | pas de `$transaction` ; cleanup best-effort | P1 | Transaction ou statut FAILED + doc |
| `getSpecAt` couverture | ⚠️ | `lib/spec-snapshot.ts:1-12` | Entity/Attribute/Operation seulement | P2 | Étendre relations/resources/policies/screens |
| Natural Spec / Spec Kit | ✅ | `concepts/{product-specs,screen-specs,open-questions,assumptions,sdd-artifacts}.ts`, `lib/spec-kit-sync.ts` | CRUD + from-prompt + sync disque bidirectionnel | — | — |
| Spec Kit `contracts/` sync | ⚠️ | `lib/spec-kit-sync.ts:13` | `contracts/` non syncé (V1) | P1 | Ajouter le kind contracts/ au sync |
| Spec Kit = cadrage ≠ vérité | ✅ | `docs/SPECKIT_INTEGRATION.md:146-166` | règle documentée (doc schéma légèrement désync) | P2 | Resync doc avec le vrai modèle SpecArtifact |
| RuntimeTarget (runtime) | ✅ | `lib/contracts/runtime-target.ts:41-155` | DEFAULT hono-next correct ; get/set + gating table absente | — | — |
| Compilation contrats | ✅ | `lib/contracts/compile-{backend,frontend,shared}.ts`, `validate-contracts.ts`, `explain-contracts.ts` | 3 compilateurs + validate + explain | — | — |
| Pipeline contract-driven | ⚠️ | `codegen/codegen.ts:594-643` | generateApp compile les 3 contrats ; **mais `validateContracts` n'est PAS un gate** ; `emit-prisma` lit le spec brut (documenté) | P1 | Câbler validateContracts comme barrière bloquante dans generateApp |
| Mappings backend (8) | ⚠️ | `compile-backend.ts`, `emit-{hono,auth,prisma}.ts` | 4/8 complets (Entity/Attr/Resource/Operation) ; AuthMethod+Policy+EventDef partiels ; **Asset absent** | P1 | Ajouter Asset ; compléter auth handler /api/auth/*, guards réels |
| Mappings frontend Next16 (8) | ⚠️ | `compile-frontend.ts`, `emit-next.ts`, `emit-sdk.ts` | 1/8 complet (Screen) ; Form/Field/Action/DataBinding **compilés mais non émis** ; Theme/Translation absent | P1 | `emit-next` doit consommer forms/actions/dataBindings ; ajouter theme/i18n |
| Arborescence générée | ✅ | `docs/CODEGEN.md`, `emit-*.ts` | chemins réels conformes apps/api + apps/web + packages/shared + tests | — | bug indentation doc `CODEGEN.md:158` (P2) ; dirs assets/events non émis (P1) |
| MCP tools | ✅ | `backend/src/mcp.ts` | 39/39 de la liste + 102 total enregistrés | — | — |
| Agents Claude Code | ✅ | `.claude/agents/dtfs-*.md` | 19/19 + bonus ; chevauchements + outils manquants (voir P1) | P1 | Voir items agents ci-dessous |
| Slash commands | ✅ | `.claude/commands/dtfs/*.md` | 20/20 ; legacy flat coexistent | P2 | Dédupliquer flat vs dtfs/ |
| Ordre `/dtfs:generate-app` | ⚠️ | `.claude/commands/dtfs/generate-app.md:62-73` | compile shared→backend→frontend (vs ref backend→frontend→shared) ; étapes granulaires & typecheck non dans le flux formel | P1 | Documenter l'ordre de référence ; intégrer typecheck + résumé |
| Hooks | ⚠️ | `.claude/settings.json`, `settings.local.json`, `scripts/dtfs-*.sh` | 2/4 actifs (PreToolUse guard-apply + Stop audit) ; UserPromptSubmit & PostToolUse scriptés mais **non enregistrés** | P1 | Enregistrer detect-input + commit-summary ; ajouter guards génération/écrasement |
| GeneratedArtifacts (tracking) | ⚠️ | `codegen/types.ts:23`, `codegen.ts:378-411` | manifest + contentHash OK ; `protected` codé en dur `false` | P1 | Voir P0 (protection réelle) |
| Fichiers générés identifiables | ✅ | `emit-*.ts` (en-têtes `// Auto-generated`) | — | — | — |
| Tests déterministes | ✅ | `backend/src/**/*.test.ts` (15 fichiers, 330 tests) | 9/9 catégories | — | — |
| Tests golden | ⚠️ | `test/golden/pipeline.golden.test.ts`, `codegen-contracts.test.ts` | 2/6 (Proposal→Delta, Spec→Contracts) ; étapes LLM prompt→spec non couvertes | P2 | Goldens contractuels pour les étapes LLM |
| Tests generated-app | ⚠️ | `emit-tests.ts`, `codegen.ts:451` | stubs only ; `runGeneratedTests` → toujours skipped | P1 | Générer des tests exécutables |
| Garde-fou : écriture hors ChangeSet | ✅ | `lib/changeset-middleware.ts` | enforced sur `/api/projects/:id/*` | — | — |
| Garde-fou : apply sans validate | ⚠️ | `mcp.ts:414-430`, `guardrails.ts:245` | guard existe mais **non appelé** dans le chemin apply | **P0** | Enforcer guardValidateBeforeApply dans applyDeltaSpec/apply_spec |
| Garde-fou : génération sans contrats valides | ⚠️ | `mcp.ts:1888`, `validate-contracts.ts` | non appelé dans generateApp | P1 | Gate validateContracts dans generateApp |
| Garde-fou : secret en clair | ✅ | `guardrails.ts:129` + tests | implémenté + testé | — | — |
| Garde-fou : fonction Expr inventée | ✅ | `guardrails.ts:219`, `expr-validate.ts:110` | rejet strict | — | — |
| Garde-fou : question critique ouverte | ⚠️ | `guardrails.ts:299`, `governance-check.ts:100` | gate non activé auto (flag jamais passé) | P1 | Activer checkClarificationGate avant génération |
| Garde-fou : Requirement prioritaire non mappé | ⚠️ | `lib/coverage-gate.ts` | détection présente, non intégrée au pipeline | P1 | Intégrer coverage-gate avant apply/génération |
| Garde-fou : fichier manuel écrasé | ⚠️ | `codegen/types.ts:23` | `protected` toujours false → jamais effectif | **P0** | Rendre `protected` réel + bloquer l'écrasement |
| Garde-fou : Better Auth isolé | ✅ | `codegen/emit-auth.ts` | cantonné à apps/api/src/auth.ts | — | — |
| Garde-fou : frontend via SDK typé | ⚠️ | `emit-next.ts:166`, `emit-sdk.ts` | SDK généré mais pages stubs ne l'importent pas | P2 | Câbler le client dans les pages |
| Garde-fou : policies backend ≠ guards frontend | ⚠️ | `emit-hono.ts:359-374` | middlewares générés en stubs pass-through | P1 | Implémenter la compilation PolicyRule→middleware |

---

## P0 — À corriger avant de continuer

Courts, impératifs (violent les règles §18 du projet) :

1. **Enforcer `validateDeltaSpec` avant tout apply.** `dtfs__apply_delta_spec` / `dtfs__apply_spec` appellent `applyDeltaSpec` directement (seul un parse Zod). 🔧 Appeler `guardValidateBeforeApply` / `runGovernanceChecks` *dans* `applyDeltaSpec` et refuser si `!ok`. (`mcp.ts:414`, `lib/delta-spec-apply.ts`, `guardrails.ts:245`)
2. **Rendre la protection des fichiers manuels réelle.** `ManifestEntry.protected` est codé en dur à `false` → un `generate` non-dryRun peut écraser un fichier édité à la main sans alerte. 🔧 Détecter les fichiers absents du manifest précédent / marqués protected et **refuser l'écrasement** (pas seulement le signaler). (`codegen/types.ts:23`, `codegen.ts:378-411`)

---

## P1 — À corriger ensuite (important, non bloquant)

**Gouvernance / pipeline**
- Câbler `validateContracts` comme gate bloquant dans `generateApp`.
- Activer `checkClarificationGate` (questions critiques) et `coverage-gate` (Requirements prioritaires non mappés) dans le chemin apply/génération.

**Codegen incomplet**
- `emit-next.ts` : consommer `contract.forms` / `actions` / `dataBindings` (aujourd'hui compilés puis ignorés → pages vides).
- Mapping **Asset** absent : l'ajouter à `compileBackendContract` + créer `emit-asset.ts`.
- Policy → middleware backend : remplacer les stubs pass-through par la compilation réelle de `PolicyRule`.
- Better Auth : émettre le handler `/api/auth/*` + middleware session (aujourd'hui config stub seule).
- `applyDeltaSpec` : implémenter les 9 buckets `not_implemented_yet` + rendre l'apply transactionnel (ou statut FAILED explicite).
- Tests generated-app exécutables (sortir des stubs).

**Schéma / cohérence**
- `OperationKind.WORKFLOW` : retirer la valeur active (ou guard de rejet).
- `AuthMethodKind` : résoudre le doublon `APIKEY`/`API_KEY` + aligner le Zod DeltaSpec.
- `GeneratedArtifact` : ajouter `ownership`, `protected`, `generatedFrom`, `runtimeTargetId` (migration additive).
- Dette **JSONata** : finir la migration vers l'AST, retirer `jsonata` + `expr.ts`/`policy.ts` legacy (ou les isoler).

**Harness**
- `dtfs-generated-code-reviewer` : ajouter `check_generated_project` + `typecheck_generated_project` à ses tools.
- Double ownership `accept_platform_proposal` (platform-mapper *et* spec-writer) : clarifier le propriétaire.
- Enregistrer les hooks `dtfs-detect-input` (UserPromptSubmit) et `dtfs-commit-summary` (PostToolUse) si voulus.
- Spec Kit : ajouter le sync de `contracts/`.
- Doc : insérer `PlatformSpecProposal` dans le Full Chain ; aligner nomenclature generate*/emit*.

---

## P2 — Améliorations (nice-to-have)

- Créer `docs/HARNESS_DEV.md` (ou le retirer de la liste de référence).
- `getSpecAt` : étendre au-delà de Entity/Attribute/Operation.
- Goldens contractuels pour les étapes LLM (prompt→ProductSpec, etc.).
- Dédupliquer les commandes legacy `commands/dtfs-*.md` vs `commands/dtfs/`.
- Câbler le SDK typé dans les pages Next générées.
- Corriger l'indentation `web/` dans `CODEGEN.md:158` ; resync le schéma dans `SPECKIT_INTEGRATION.md`.
- Tension doc `CODEGEN_CONTRACT.md` (PlatformSpec interne) vs docs contrats persistés — clarifier la transition.

---

## Plan de patch recommandé (5 étapes)

1. **Barrières d'exécution (P0 + gouvernance P1)** — faire de `validateDeltaSpec`, `validateContracts`, clarification-gate et coverage-gate des *gates bloquants* dans `applyDeltaSpec` et `generateApp` ; rendre `protected` effectif (refus d'écrasement). → referme les 3 impératifs §18 non tenus.
2. **Cohérence du schéma** — migration additive : retirer/garder WORKFLOW, dédoublonner AuthMethodKind, enrichir `GeneratedArtifact` (ownership/protected/generatedFrom/runtimeTargetId). Aligner les enums Zod DeltaSpec.
3. **Complétude codegen frontend + Asset** — `emit-next` consomme forms/actions/dataBindings ; ajout du mapping Asset (contrat + `emit-asset.ts`) ; Policy→middleware réel ; handler Better Auth.
4. **DeltaSpec apply complet + transactionnel** — implémenter les 9 buckets manquants, wrapper en `$transaction` (ou statut FAILED), puis tests d'apply par bucket.
5. **Dette & finitions** — retirer JSONata legacy ; enregistrer les hooks opt-in ; sync `contracts/` Spec Kit ; corrections doc (Full Chain, nomenclature, HARNESS_DEV). 

> **STOP** — Aucune modification effectuée. En attente d'accord avant tout patch.
