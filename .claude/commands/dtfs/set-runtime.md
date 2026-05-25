---
description: "Configure le RuntimeTarget d'un projet (stack backend/frontend/auth, outputDir). Phase 26."
---

Invoque l'agent `dtfs-runtime-architect` pour choisir et persister la
configuration de génération du projet.

## Cible

$ARGUMENTS

## Format attendu

`<projectId> [stack]`

Exemples :
- `proj_123` — propose la stack par défaut (Hono + Next.js 16 + Better Auth)
- `proj_123 hono+next16+better-auth` — stack explicite

## Instructions

1. Identifier le `projectId` depuis `$ARGUMENTS`. Si absent, appeler
   `dtfs__list_projects` et demander.
2. Lancer l'agent `dtfs-runtime-architect` avec le `projectId` et les
   préférences de stack éventuelles.
3. L'agent lit la spec, propose une config, demande confirmation, puis
   appelle `dtfs__set_runtime_target`.
4. Confirmer à l'utilisateur le RuntimeTarget persisté et suggérer :
   "Prochaine étape : `/dtfs:compile-contracts <projectId>`."
