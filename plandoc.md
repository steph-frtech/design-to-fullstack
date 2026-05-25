# plandoc.md — Orchestration du vault de documentation DTFS (docs-vault/)

> Plan d'orchestration pour construire un vault Obsidian complet, versionnable, exploitable par IA.
> Exécution : pattern orchestrateur (step-executor par work-package → step-verifier final).
> **Création de docs uniquement** — aucune modification de l'application, DB, migrations, code, git.

## Phase 0 — Audit initial (FAIT, read-only)
- `docs-vault/` : ABSENT → à créer.
- Existant réutilisable : `docs/` (35 md), `.claude/` (20 agents + 20 commands), `backend/` (52 modèles, 14 migrations, 102 MCP tools, codegen/dsl/contracts), `docs/AUDIT_REPORT.md`.
- À créer ex nihilo : OpenAPI (0 présent), JSON Schema (0 présent), Excalidraw, Mermaid, ADR, AI context.
- `specs/`, `.specify/`, `generated-apps/`, `packages/` absents du méta-repo (artefacts runtime — normal).
- **Règle d'honnêteté** : chaque doc porte un Status ∈ {documented, partially implemented, implemented, tested}. Ne pas prétendre implémenté ce qui n'est que documenté (cf. AUDIT_REPORT : codegen frontend stubs, Asset absent, guards non enforced, RuntimeInstance/Docker client = cible).

## Convention par fichier (imposée à tous les agents)
Chaque `.md` du vault contient : titre clair · résumé ≤5 lignes · liens Obsidian `[[...]]` vers pages liées · section **Source of truth** (pointer vers le code/doc réel) · section **AI usage** · section **Status**.

## Frontière structurante à marmarteler partout
**DTFS Control Plane ≠ Application cliente générée.** BDD séparées. Aucune table métier/ session Better Auth client dans la base du Control Plane. RuntimeTarget (plan) ≠ RuntimeInstance (instance lancée) ≠ DeploymentTarget (lieu d'exécution).

## Work-packages (step-executor, dossiers disjoints → parallélisables)

| WP | Dossiers / livrables | Phases brief |
|----|----------------------|--------------|
| **W1** | scaffold + `00_Home/` placeholders + `docs-vault/README.md` + `.gitignore` | 1, 20 |
| **W2** | `01_Product/` (7) + `02_Architecture/` (7) | 2, 3 |
| **W3** | `03_Control_Plane/` (9 — concepts, DeltaSpec, DSLs, ChangeSet, behaviors, spec kit) | 6, 7, 8 |
| **W4** | `04_Runtime_Contracts/` (7) + `05_Generated_App/` (9) | 9, 10, 11 |
| **W5** | `06_API/` + `openapi/` (2 yaml) + `07_Schemas/` + `schemas/` (8 json) | 12, 13 |
| **W6** | `08_Diagrams/` excalidraw (6) + mermaid (7) | 4, 5 |
| **W7** | `09_ADR/` (10 + README) + `10_Agents_MCP_Skills/` (6) + `11_Testing/` (6) + `12_Operations/` (7) | 14, 15, 16, 17 |
| **W8** | `13_AI_Context/` (5 + 5 prompts) | 18 |
| **WF** | Remplir `00_Home/` (README, MAP_OF_CONTENT, AI_INDEX, GLOSSARY) avec backlinks réels + **Documentation Build Report** | 19, 21 |

Exécution : W1 d'abord (scaffold léger), puis W2–W8 en lots parallèles (dossiers disjoints, pas de conflit), enfin WF (dépend de l'existence des autres pour les backlinks) + verifier.

## Source-of-truth mapping (pour ancrer le contenu)
- Control Plane concepts → `backend/prisma/schema.prisma`, `docs/BACKEND_MODEL.md`, `docs/SCHEMA_INVENTORY.md`
- DeltaSpec → `backend/src/lib/dsl/delta-spec.ts`, `docs/DELTA_SPEC.md`
- Expr/Operation/Policy → `backend/src/lib/dsl/*`, `docs/EXPR_DSL.md`, `docs/OPERATION_DSL.md`, `docs/POLICY_DSL.md`
- ChangeSet → `backend/src/changesets.ts`, `lib/revert.ts`, `docs/CHANGESET_FLOW.md`
- Contracts → `backend/src/lib/contracts/*`, `docs/{RUNTIME_TARGET,BACKEND_CONTRACT,FRONTEND_CONTRACT,SHARED_CONTRACT}.md`
- Codegen → `backend/src/codegen/*`, `docs/CODEGEN.md`, `docs/{HONO,BETTER_AUTH,NEXT16,SDK}_GENERATION.md`
- Agents/MCP/commands → `.claude/agents/`, `.claude/commands/dtfs/`, `docs/MCP_TOOLS.md`, `docs/HARNESS.md`
- Tests/sécurité → `backend/src/**/*.test.ts`, `docs/{TESTING,GOVERNANCE,VALIDATION}.md`
- État réel & gaps → `docs/AUDIT_REPORT.md`

## Critères de réussite (Phase 22)
Humain comprend l'archi en <30 min · IA sait quoi lire avant de modifier (AI_INDEX) · grands schémas Excalidraw · flows Mermaid · specs MD · API OpenAPI · objets JSON Schema/Zod · décisions ADR · Control Plane vs app cliente clair · contrats documentés · règles sécurité/génération explicites · versionnable Git.

## État
- [ ] W1 - [ ] W2 - [ ] W3 - [ ] W4 - [ ] W5 - [ ] W6 - [ ] W7 - [ ] W8 - [ ] WF → verifier → Build Report
