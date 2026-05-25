---
description: "Orchestre la génération complète de l'app (contracts → generate_app). LE point d'entrée principal du pipeline codegen. Dry-run par défaut."
---

Invoque l'agent `dtfs-codegen-orchestrator` pour compiler les trois contrats
puis générer l'application complète via `dtfs__generate_app`.

C'est **la commande principale** du pipeline runtime/codegen. Elle enchaîne :
compile SharedContract → compile BackendContract → compile FrontendContract →
validate_contracts → generate_app (dry-run d'abord).

## Cible

$ARGUMENTS

## Format attendu

`<projectId> [--write] [--out <dir>]`

- Sans `--write` : s'arrête après le dry-run (plan de génération affiché,
  aucun fichier écrit).
- `--write` : génère réellement les fichiers après confirmation explicite.
- `--out <dir>` : surcharge le `outputDir` du RuntimeTarget.

## Prérequis

Avant de lancer cette commande, le projet doit avoir :
1. Un spec Control Plane complet (entités, opérations, screens, authMethods).
2. Un RuntimeTarget configuré (sinon → `/dtfs:set-runtime <projectId>`).
3. Tous les gates verts (clarification + coverage).

## Instructions

1. Identifier le `projectId` depuis `$ARGUMENTS`. Si absent, appeler
   `dtfs__list_projects` et demander.

2. Vérifier le RuntimeTarget : `dtfs__get_runtime_target(projectId)`.
   Si absent, arrêter : "Aucun RuntimeTarget — lancer
   `/dtfs:set-runtime <projectId>` d'abord."

3. Lancer l'agent `dtfs-codegen-orchestrator` avec :
   - `projectId`
   - `dryRun: true` toujours en premier
   - `outDir` si fourni via `--out`

4. L'orchestrateur :
   - Compile les 3 contrats dans l'ordre (shared → backend → frontend).
   - Valide avec `dtfs__validate_contracts`. Bloque si `ok: false`.
   - Lance `dtfs__generate_app(dryRun: true)` et affiche le plan.
   - Si `--write` : demande confirmation explicite, puis
     `dtfs__generate_app(dryRun: false)`.

5. Après génération :
   - Proposer : "Lancer `/dtfs:check-generated <projectId> --out <dir>`
     pour valider la structure et les types."

## Flux complet (référence)

```
/dtfs:generate-app <projectId>
  → dtfs-codegen-orchestrator
    → dtfs__compile_shared_contract
    → dtfs__compile_backend_contract
    → dtfs__compile_frontend_contract
    → dtfs__validate_contracts         [bloque si invalide]
    → dtfs__explain_contracts          [résumé]
    → dtfs__generate_app (dryRun=true) [plan]
    → [confirmation utilisateur]
    → dtfs__generate_app (dryRun=false)[écriture]
    → dtfs__preview_generated_file     [échantillons]
  → /dtfs:check-generated
  → /dtfs:run-generated-tests
```
