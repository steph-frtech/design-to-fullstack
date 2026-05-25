---
description: "Génère le SDK TypeScript partagé (Zod schemas, AppType, hono/client) depuis le SharedContract. Dry-run par défaut. Granular tool Phase 28 pending."
---

Invoque l'agent `dtfs-sdk-generator` pour produire le package `shared/`
contenant les types Zod, l'`AppType` et le client typé `hono/client`.

> **Note.** Un tool granulaire `dtfs__generate_shared_sdk` est prévu en
> Phase 28 (pending). En attendant, la génération passe par
> `dtfs__generate_app` filtré aux fichiers shared/SDK.

## Cible

$ARGUMENTS

## Format attendu

`<projectId> [--write] [--out <dir>]`

- Sans `--write` : dry-run uniquement (prévisualisation).
- `--write` : génère réellement les fichiers après confirmation.
- `--out <dir>` : surcharge le `outputDir` du RuntimeTarget.

## Instructions

1. Identifier le `projectId` depuis `$ARGUMENTS`.
2. Vérifier que le SharedContract est compilé (`dtfs__compile_shared_contract`).
   Si non compilé, arrêter : "Lancer `/dtfs:compile-contracts` d'abord."
3. Lancer l'agent `dtfs-sdk-generator` avec les paramètres extraits.
4. L'agent effectue le dry-run, filtre les fichiers shared/SDK, demande
   confirmation avant d'écrire si `--write` est présent.
5. Après génération : "Vérifier avec `/dtfs:check-generated`."
