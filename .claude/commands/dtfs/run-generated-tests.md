---
description: "Lance les tests du projet généré (vitest / jest). Granular tool dtfs__run_generated_tests Phase 28 pending."
---

Lance la suite de tests du code généré dans le répertoire de sortie et
rapporte les résultats. Confirme que l'app générée est fonctionnellement
correcte.

> **Note.** Un tool granulaire `dtfs__run_generated_tests` est prévu en
> Phase 28 (pending). En attendant, les tests sont lancés via `Bash`
> (`pnpm test` ou `vitest run`) dans le répertoire de sortie.

## Cible

$ARGUMENTS

## Format attendu

`<projectId> --out <dir> [--filter <pattern>]`

- `--out <dir>` : chemin absolu vers le répertoire de sortie généré
  (obligatoire).
- `--filter <pattern>` : filtre vitest/jest optionnel (ex. `auth`, `api`).

## Instructions

1. Identifier `projectId` et `outDir` depuis `$ARGUMENTS`.
   Si `--out` est absent, arrêter : "Le chemin --out <dir> est requis."

2. Vérifier que le code a déjà passé `/dtfs:check-generated`. Si un
   `BLOCKED` TypeScript est connu, avertir l'utilisateur avant de lancer.

3. Détecter le runner de tests dans `<outDir>` :
   - Si `vitest.config.ts` existe → `pnpm exec vitest run`
   - Si `jest.config.*` existe → `pnpm exec jest --passWithNoTests`
   - Sinon → indiquer qu'aucun runner n'a été trouvé et arrêter.

4. Lancer les tests via `Bash` dans `<outDir>` :
   ```bash
   cd <outDir> && pnpm exec vitest run [--reporter=verbose] [--filter <pattern>]
   ```

5. Afficher le résumé des résultats :

   ```
   ## Tests — <projectId>

   | Suite       | Pass | Fail | Skip | Durée |
   |-------------|------|------|------|-------|
   | auth        | N    | N    | N    | Xs    |
   | api         | N    | N    | N    | Xs    |
   | frontend    | N    | N    | N    | Xs    |
   | **Total**   | **N**| **N**| **N**| **Xs**|
   ```

6. Pour chaque test en échec, afficher le nom du test + le message d'erreur
   (extrait du log).

7. Verdict final :
   - `ALL PASS` — app générée validée.
   - `FAILURES` — lister les tests en échec et suggérer une correction.

8. Prochaine étape :
   - Si ALL PASS : "App générée et validée — prête pour review manuelle ou
     déploiement."
   - Si FAILURES : "Corriger les échecs ou relancer `/dtfs:generate-app`
     avec un spec corrigé."
