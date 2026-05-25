---
description: "Génère la configuration Better Auth depuis les AuthMethods du spec. Dry-run par défaut. Granular tool Phase 28 pending."
---

Invoque l'agent `dtfs-better-auth-generator` pour produire le fichier
`auth.ts`, le middleware de session et le wiring des plugins Better Auth.

> **Note.** Un tool granulaire `dtfs__generate_auth_runtime` est prévu en
> Phase 28 (pending). En attendant, la génération passe par
> `dtfs__generate_app` filtré aux fichiers auth.

## Cible

$ARGUMENTS

## Format attendu

`<projectId> [--write] [--out <dir>]`

- Sans `--write` : dry-run uniquement (prévisualisation).
- `--write` : génère réellement les fichiers après confirmation.
- `--out <dir>` : surcharge le `outputDir` du RuntimeTarget.

## Instructions

1. Identifier le `projectId` depuis `$ARGUMENTS`.
2. Vérifier que le projet a au moins un `authMethod` dans le spec
   (`dtfs__get_project_spec`). Si aucun, arrêter : "Aucun AuthMethod défini
   dans le spec — ajoutez un authMethod avant de générer."
3. Vérifier que le BackendContract est compilé.
4. Lancer l'agent `dtfs-better-auth-generator` avec les paramètres extraits.
5. L'agent effectue le dry-run, filtre les fichiers auth, demande confirmation
   avant d'écrire si `--write` est présent.
6. Après génération : "Vérifier avec `/dtfs:check-generated`."
