---
description: "Génère l'app Next.js 16 App Router depuis le FrontendContract. Dry-run par défaut. Granular tool Phase 28 pending."
---

Invoque l'agent `dtfs-next16-generator` pour produire les pages, layouts,
Server Components et hooks TanStack Query du projet.

> **Note.** Un tool granulaire `dtfs__generate_frontend_next` est prévu en
> Phase 28 (pending). En attendant, la génération passe par
> `dtfs__generate_app` filtré aux fichiers frontend.

## Cible

$ARGUMENTS

## Format attendu

`<projectId> [--write] [--out <dir>]`

- Sans `--write` : dry-run uniquement (prévisualisation).
- `--write` : génère réellement les fichiers après confirmation.
- `--out <dir>` : surcharge le `outputDir` du RuntimeTarget.

## Instructions

1. Identifier le `projectId` depuis `$ARGUMENTS`.
2. Vérifier que le FrontendContract est compilé
   (`dtfs__compile_frontend_contract`). Si non compilé ou invalide,
   arrêter : "Lancer `/dtfs:compile-contracts` d'abord."
3. Lancer l'agent `dtfs-next16-generator` avec les paramètres extraits.
4. L'agent effectue le dry-run, filtre les fichiers frontend (`app/`,
   `components/`), demande confirmation avant d'écrire si `--write` est présent.
5. Après génération : "Vérifier avec `/dtfs:check-generated`."
