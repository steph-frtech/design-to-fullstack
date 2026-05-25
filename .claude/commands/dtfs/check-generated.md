---
description: "Valide le code généré : structure, fichiers protégés, TypeScript, heuristiques qualité. Granular tools Phase 28 pending."
---

Invoque l'agent `dtfs-generated-code-reviewer` pour auditer les fichiers
produits par `dtfs__generate_app` dans le répertoire de sortie.

> **Note.** Des tools granulaires `dtfs__check_generated_project` et
> `dtfs__typecheck_generated_project` sont prévus en Phase 28 (pending).
> En attendant, la vérification utilise `Read`, `Bash` (tsc --noEmit) et
> `dtfs__preview_generated_file`.

## Cible

$ARGUMENTS

## Format attendu

`<projectId> --out <dir>`

- `--out <dir>` est **obligatoire** : chemin absolu vers le répertoire de
  sortie utilisé lors de la génération.

## Instructions

1. Identifier `projectId` et `outDir` depuis `$ARGUMENTS`.
   Si `--out` est absent, arrêter : "Le chemin --out <dir> est requis."

2. Lancer l'agent `dtfs-generated-code-reviewer` avec `projectId` et
   `outDir`.

3. L'agent vérifie :
   - Structure des couches (database, backend, frontend, sdk).
   - Fichiers protégés à risque d'écrasement.
   - Erreurs TypeScript (`tsc --noEmit`).
   - Heuristiques qualité (TODOs, directives manquantes, handlers vides).

4. Afficher le rapport complet avec le verdict final :
   - `PASS` — code prêt pour les tests.
   - `WARNINGS` — problèmes non bloquants, revue recommandée.
   - `BLOCKED` — erreurs TypeScript ou fichiers protégés → corriger avant
     de continuer.

5. Prochaine étape :
   - Si PASS/WARNINGS : "Lancer `/dtfs:run-generated-tests <projectId>`."
   - Si BLOCKED : "Corriger les erreurs listées, puis relancer
     `/dtfs:check-generated`."
