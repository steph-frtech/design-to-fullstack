# AUDIT_PLAN — Audit de conformité DTFS (lecture seule)

> Le `plan.md` existant est le **spec de build** (2197 lignes, committé) — on n'y touche pas.
> Ce fichier est le plan de l'**audit read-only** demandé. Sortie : `docs/AUDIT_REPORT.md`.

## Règle impérative
**Lecture seule.** Aucun fichier du projet modifié, aucune commande mutante, aucun write DB,
aucune migration, aucun git. Seuls artefacts écrits : ce plan + `docs/AUDIT_REPORT.md`.
Après le rapport → **STOP**, attendre l'accord utilisateur avant tout patch.

## Légende
✅ Présent et conforme · ⚠️ Présent mais incomplet · ❌ Manquant · 🔧 Correction recommandée
Priorité : P0 (bloquant) / P1 (important) / P2 (nice-to-have)

## Orchestration — 6 work-packages read-only (agents en parallèle)

| WP | Couvre (sections du brief) | Périmètre |
|----|----------------------------|-----------|
| **A — Docs & flux** | §1 | ~20 docs/*.md existent + cohérents ; flux cible Natural→…→GeneratedArtifacts documenté |
| **B — Données : Prisma + DeltaSpec + ChangeSet** | §2, §3, §6 | schema.prisma (tous modèles + contraintes Operation.kind/AuthMethod/Asset/GeneratedArtifact/RuntimeTarget/Contracts) ; migrations additives ; DeltaSpec canonique + validate/apply/explain/diff ; ChangeSet/Revision begin/commit/discard/revert/getSpecAt/diff + transactionnel |
| **C — DSLs Expr/Operation/Policy** | §4, §5 | Expr AST typé + catalogue fermé (8 fns) + roots ; OperationStep (10) ; PolicyRule (12) ; usage Expr (pas JSONata libre) ; dette jsonata |
| **D — Runtime/Contracts + mappings + codegen + arbo** | §8, §9, §10, §16 | RuntimeTarget (Hono/BetterAuth/Next16/PG/Prisma/pnpm) ; Backend/Frontend/SharedContract ; pipeline compile→validate→generate ; mappings backend (Entity/Attr/Resource/Operation/Policy/AuthMethod/Asset/Event) + frontend Next16 (Screen/Component/Form/Field/Action/DataBinding/Policy/Theme) ; codegen lit contrats (pas concepts bruts) ; arbo generated-app cible |
| **E — Harness : MCP + Agents + Commands + Hooks** | §11, §12, §13, §14 | inventaire des ~45 MCP tools (présent/fichier/Zod in-out/effet) ; 19 agents ; 20 slash commands + ordre /dtfs:generate-app ; hooks settings.json (UserPromptSubmit/PreToolUse/PostToolUse/Stop) |
| **F — GeneratedArtifacts + Tests + Sécurité + Spec Kit** | §7, §15, §17, §18 | Spec Kit (constitution/specs/* + règle cadrage≠vérité) ; GeneratedArtifact (path/kind/contentHash/ownership/protected/changeSetId/generatedFrom/runtimeTargetId) + non-écrasement ; tests déterministes/golden/generated-app ; garde-fous (12 règles) |

Chaque WP → 1 agent read-only, citant des **preuves concrètes** (chemins, `grep -c`, lignes).
Pas de step-verifier (audit = déjà de la vérification) ; cross-check à l'agrégation.

## Agrégation → `docs/AUDIT_REPORT.md`
Structure imposée :
1. **Résumé exécutif** — score global %, solide / fragile / manquant, risque principal
2. **Tableau de conformité** — Domaine · Statut · Fichiers · Commentaire · Priorité · Correction
3. **P0** — à corriger avant de continuer (court, impératif)
4. **P1** — important non bloquant
5. **P2** — améliorations
6. **Plan de patch recommandé** — 5 étapes max

## Mapping 12 couches → WP
1 Natural Spec → F · 2 Spec Kit/SDD → F · 3 Control Plane → B · 4 DeltaSpec/ChangeSet → B ·
5 Expr/Op/Policy DSL → C · 6 RuntimeTarget → D · 7 Contracts → D · 8 Codegen → D ·
9 MCP → E · 10 Agents/Skills → E · 11 GeneratedArtifacts → F · 12 Tests/sécurité → F

## État
- [ ] A  - [ ] B  - [ ] C  - [ ] D  - [ ] E  - [ ] F  → puis agrégation → STOP (await accord)
