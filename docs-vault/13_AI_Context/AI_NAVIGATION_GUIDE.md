# AI Navigation Guide — Quel doc lire pour quelle tâche

Table de correspondance tâche → documents à lire. Utiliser cette table avant d'agir pour s'assurer de lire la bonne source de vérité et les bonnes contraintes.

Liens : [[AI_PROJECT_BRIEF]] · [[AI_RULES]] · [[../00_Home/AI_INDEX]]

---

## Table tâche → docs

| Tâche | Documents à lire (dans l'ordre) |
|---|---|
| **Arriver sur le projet pour la première fois** | `AI_PROJECT_BRIEF` → `AI_RULES` → `AI_DO_NOT_BREAK` → `docs/EXECUTION_FLOW.md` |
| **Modifier le Control Plane** (Entity, Operation, Policy, Schema) | `AI_RULES` (R01–R03) · `docs/DELTA_SPEC.md` · `docs/CHANGESET_FLOW.md` · `AI_DO_NOT_BREAK` |
| **Écrire ou valider un DeltaSpec** | `docs/DELTA_SPEC.md` · `AI_RULES` (R01–R03, R09) · `docs/GOVERNANCE.md` |
| **Appliquer un DeltaSpec (apply)** | `AI_RULES` (R02, R03) · `docs/CHANGESET_FLOW.md` · `docs/GOVERNANCE.md` · `AI_GENERATION_CHECKLIST` |
| **Compiler les contrats** | `docs/CODEGEN_CONTRACT.md` (ou `docs/RUNTIME_CONTRACTS.md`) · `AI_RULES` (R04, R05) · `docs/HARNESS.md` §generate-app |
| **Générer du code (generate_app)** | `AI_GENERATION_CHECKLIST` · `AI_RULES` (R04–R08, R10–R11) · `docs/CODEGEN.md` · `docs/HARNESS.md` §generate-app |
| **Auditer l'architecture ou le pipeline** | `docs/AUDIT_REPORT.md` · `AI_RULES` · `AI_DO_NOT_BREAK` · `AI_PROMPTS/audit.md` |
| **Ajouter une couche de contrats runtime** | `docs/CODEGEN_CONTRACT.md` · `AI_RULES` (R04, R05) · `AI_PROMPTS/add-runtime-contracts.md` |
| **Générer une app cliente complète** | `AI_GENERATION_CHECKLIST` · `AI_PROMPTS/generate-client-app.md` · `docs/HARNESS.md` §generate-app |
| **Vérifier les frontières architecturales** | `AI_RULES` (R06, R07) · `AI_DO_NOT_BREAK` · `AI_PROMPTS/verify-architecture.md` |
| **Utiliser un agent ou slash command** | `docs/HARNESS.md` (table des agents + commandes) · `AI_PROJECT_BRIEF` §pipeline |
| **Modifier un fichier généré manuellement** | `AI_RULES` (R08) · `docs/CODEGEN.md` §protected · `AI_DO_NOT_BREAK` |
| **Ajouter une fonction Expr** | `AI_RULES` (R09) · `backend/src/lib/dsl/expr-ast.ts` — le catalogue est fermé : ne pas ajouter sans décision explicite |
| **Résoudre des OpenQuestions** | `AI_RULES` (R10) · `docs/HARNESS.md` §dtfs-question-manager · pipeline étape 3 |
| **Lire ou écrire un GeneratedArtifact** | `AI_RULES` (R11) · `docs/CODEGEN.md` §manifest · `docs/AUDIT_REPORT.md` §GeneratedArtifact |
| **Prendre une décision d'architecture** | `AI_RULES` (R12) · créer un ADR dans `docs/ADR/` |
| **Comprendre le schéma Prisma** | `backend/prisma/schema.prisma` · `docs/AUDIT_REPORT.md` §schéma |
| **Comprendre les MCP tools disponibles** | `docs/MCP_TOOLS.md` · `docs/HARNESS.md` · `AI_PROJECT_BRIEF` §pipeline |
| **(Re)générer ce vault de docs** | `AI_PROMPTS/generate-docs.md` |

---

## Règle de priorisation

1. `AI_RULES` et `AI_DO_NOT_BREAK` — toujours lus en premier si l'action touche la spec ou le codegen.
2. La doc spécifique au domaine (`DELTA_SPEC`, `CODEGEN`, `GOVERNANCE`…) — lire la section pertinente.
3. `AI_GENERATION_CHECKLIST` — obligatoire avant tout `generate_app` non-dryRun.
4. Les prompts réutilisables (`AI_PROMPTS/`) — utiliser plutôt que réinventer.

## Source of truth

`docs/HARNESS.md` · `docs/EXECUTION_FLOW.md` · `docs/AUDIT_REPORT.md`

## AI usage

Table de navigation rapide. Si une tâche ne figure pas dans cette table, lire `AI_PROJECT_BRIEF` puis `AI_RULES` avant tout.

## Status

Stable — à mettre à jour si de nouveaux docs ou agents sont ajoutés.
