# Prompt réutilisable — (Re)générer ou mettre à jour le vault DTFS

Prompt pour créer ou mettre à jour les fichiers de documentation du vault sous `docs-vault/`. À utiliser quand l'architecture évolue significativement et que les docs deviennent obsolètes.

Liens : [[../AI_PROJECT_BRIEF]] · [[../AI_NAVIGATION_GUIDE]]

---

## Prompt — Mise à jour du vault AI Context

```
Tu es un rédacteur de documentation technique read-only pour le projet DTFS.
Ta mission : mettre à jour (ou recréer) les fichiers sous `docs-vault/13_AI_Context/`.

CONTRAINTES IMPÉRATIVES :
- Ne modifie AUCUN fichier applicatif (backend/, frontend/, prisma/, .claude/, etc.).
- Écris UNIQUEMENT sous `docs-vault/13_AI_Context/`.
- Ne committe pas.

SOURCES À LIRE EN PREMIER (dans cet ordre) :
1. `docs/AUDIT_REPORT.md` — état de conformité actuel.
2. `docs/GOVERNANCE.md` — les 7 guardrails.
3. `CLAUDE.md` — règles comportementales de l'agent.
4. `docs/HARNESS.md` — agents, slash commands, hooks, pipeline complet.
5. `docs/EXECUTION_FLOW.md` — pipeline 10 étapes.
6. `docs/DELTA_SPEC.md` — DSL DeltaSpec.
7. `docs/CODEGEN.md` — arborescence générée.

CONVENTION PAR FICHIER (obligatoire pour chaque fichier) :
- `# Titre` en H1.
- Résumé ≤ 5 lignes sous le titre.
- Liens `[[...]]` vers les docs connexes.
- Section `## Source of truth` — fichiers de référence.
- Section `## AI usage` — comment un agent doit utiliser ce fichier.
- Section `## Status` — état et date de la dernière mise à jour.

FICHIERS À CRÉER OU METTRE À JOUR :
- `AI_PROJECT_BRIEF.md` — brief pour un agent arrivant sur DTFS.
- `AI_RULES.md` — règles impératives avec statut d'enforcement (voir AUDIT_REPORT).
- `AI_NAVIGATION_GUIDE.md` — table tâche → docs à lire.
- `AI_DO_NOT_BREAK.md` — invariants structurels.
- `AI_GENERATION_CHECKLIST.md` — checklist avant generate_app.
- `AI_PROMPTS/audit.md` — prompt d'audit réutilisable.
- `AI_PROMPTS/generate-docs.md` — ce fichier.
- `AI_PROMPTS/verify-architecture.md` — vérification des frontières.
- `AI_PROMPTS/add-runtime-contracts.md` — ajout de contrats runtime.
- `AI_PROMPTS/generate-client-app.md` — génération d'une app cliente.

LIVRABLE :
- Liste des 10 fichiers créés/mis à jour avec leur chemin absolu.
- Confirmation : aucun fichier hors `docs-vault/13_AI_Context/` touché.
```

---

## Prompt — Mise à jour d'un fichier unique

```
Mets à jour UNIQUEMENT `docs-vault/13_AI_Context/<NOM_FICHIER>.md`.

Contexte : <décrire ce qui a changé dans l'architecture ou le code>.

Lis d'abord : <liste des fichiers sources pertinents>.

Convention : respecter le format titre / résumé / liens / Source of truth / AI usage / Status.
Ne modifie aucun autre fichier.
```

## Source of truth

`docs-vault/13_AI_Context/` (ce répertoire) · `docs/AUDIT_REPORT.md`

## AI usage

Copier le prompt dans une nouvelle session Claude Code quand les docs sont obsolètes. Fournir le contexte de ce qui a changé pour guider la mise à jour.

## Status

Stable — à relancer après chaque correction de P0/P1 dans le code.
