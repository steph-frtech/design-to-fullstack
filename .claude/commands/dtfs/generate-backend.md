---
description: "Génère la couche API Hono 4 depuis le BackendContract. Dry-run par défaut. Granular tool Phase 28 pending."
---

Invoque l'agent `dtfs-hono-api-generator` pour produire les routes Hono,
le middleware et les error handlers du projet.

> **Note.** Un tool granulaire `dtfs__generate_backend_api` est prévu en
> Phase 28 (pending). En attendant, la génération passe par
> `dtfs__generate_app` filtré aux fichiers backend.

## Cible

$ARGUMENTS

## Format attendu

`<projectId> [--write] [--out <dir>]`

- Sans `--write` : dry-run uniquement (prévisualisation).
- `--write` : génère réellement les fichiers après confirmation.
- `--out <dir>` : surcharge le `outputDir` du RuntimeTarget.

## Instructions

1. Identifier le `projectId` depuis `$ARGUMENTS`.
2. Vérifier que le BackendContract est compilé (`dtfs__compile_backend_contract`).
   Si non compilé ou invalide, arrêter : "Lancer `/dtfs:compile-contracts` d'abord."
3. Lancer l'agent `dtfs-hono-api-generator` avec les paramètres extraits.
4. L'agent effectue le dry-run, affiche le plan de fichiers backend, et
   demande confirmation avant d'écrire si `--write` est présent.
5. Après génération : "Vérifier le code généré avec `/dtfs:check-generated`."
