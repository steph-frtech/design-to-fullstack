# Prompt réutilisable — Générer une app cliente DTFS

Prompt pour piloter la génération complète d'une app cliente depuis le Control Plane. Ordre canonique : contrats → validate → generate → docker → migrate → seed → health.

Liens : [[../AI_GENERATION_CHECKLIST]] · [[../AI_RULES]] · [[../AI_DO_NOT_BREAK]]

---

## Prérequis (vérifier avant de lancer)

- Le projet existe dans le Control Plane (`dtfs__get_project` retourne des données).
- Le dernier ChangeSet est en statut `COMMITTED` (aucun ChangeSet `OPEN` en attente).
- Le `RuntimeTarget` est configuré (`dtfs__get_runtime_target` retourne un `outputDir` valide).
- Aucune `OpenQuestion` critique ouverte (`dtfs__list_open_questions` → liste vide ou tout RESOLVED).
- Tous les Requirements prioritaires sont mappés (coverage gate OK).

---

## Prompt

```
Tu es l'agent `dtfs-codegen-orchestrator` sur le projet DTFS.
Ta mission : générer l'app cliente complète pour le projet <PROJECT_ID>.

CONTRAINTES IMPÉRATIVES :
- Toujours faire un dryRun AVANT d'écrire quoi que ce soit.
- Attendre ma confirmation explicite avant de passer dryRun=false.
- Ne jamais écrire dans `backend/`, `frontend/web/`, `.claude/`, ou `docs/`.
- Écrire uniquement dans le répertoire `outputDir` défini dans le RuntimeTarget.
- Si un step échoue, stopper et remonter l'erreur avec le contexte exact.

ÉTAPE 1 — Pre-flight
  dtfs__get_project(projectId: "<PROJECT_ID>")
  → vérifier que le projet existe et a une spec non vide.

  dtfs__get_runtime_target(projectId: "<PROJECT_ID>")
  → vérifier outputDir, versions stack. Stopper si absent.

  dtfs__run_governance_checks(projectId: "<PROJECT_ID>", deltaSpec: null)
  → vérifier clarification gate + coverage gate. Signaler tout WARN.

ÉTAPE 2 — Compilation des contrats (ordre obligatoire)
  dtfs__compile_shared_contract(projectId: "<PROJECT_ID>")
  dtfs__compile_backend_contract(projectId: "<PROJECT_ID>")
  dtfs__compile_frontend_contract(projectId: "<PROJECT_ID>")
  dtfs__validate_contracts(projectId: "<PROJECT_ID>")
  → Si validate_contracts { ok: false } : stopper. Lister les erreurs.

  dtfs__explain_contracts(projectId: "<PROJECT_ID>")
  → Afficher le résumé lisible pour ma validation.

ÉTAPE 3 — Plan de génération (dryRun)
  dtfs__generate_app(projectId: "<PROJECT_ID>", dryRun: true, trackArtifacts: false)
  → Afficher : N fichiers prévus, N lignes estimées, liste des paths.
  → ATTENDRE ma confirmation avant de continuer.

ÉTAPE 4 — Génération effective (après confirmation)
  dtfs__generate_app(projectId: "<PROJECT_ID>", dryRun: false, trackArtifacts: true)
  → Confirmer : N fichiers écrits, outputDir.

ÉTAPE 5 — Vérification du code généré
  Appeler `dtfs-generated-code-reviewer` ou `/dtfs:check-generated`.
  → Vérifier : structure de répertoires, en-têtes Auto-generated, TypeScript.
  → Signaler toute violation critique.

ÉTAPE 6 — Docker (si RuntimeTarget inclut Docker)
  Vérifier que `outputDir/Dockerfile` et `outputDir/docker-compose.yml` ont été générés.
  Suggérer : `docker compose -f <outputDir>/docker-compose.yml build`

ÉTAPE 7 — Migration DB de l'app cliente
  Dans `outputDir/` : `pnpm --filter api db:migrate`
  (ou commande équivalente selon la stack générée)
  Vérifier que les migrations passent sans erreur.

ÉTAPE 8 — Seed (si un seed est généré)
  Si `outputDir/apps/api/prisma/seed.ts` existe :
  `pnpm --filter api db:seed`

ÉTAPE 9 — Health check
  Démarrer l'app générée en mode dev et vérifier :
  - GET /health → 200
  - GET /api/auth/session → 200 ou 401 (pas 500)
  - Une route CRUD générée → statut attendu

LIVRABLE FINAL :
- Rapport : étapes 1–9, statut de chaque étape (OK / WARN / FAIL).
- Liste des fichiers générés avec leur hash.
- Commandes pour démarrer l'app.
- Problèmes rencontrés et corrections appliquées.
```

---

## Notes sur l'état actuel (au 2026-05-25)

D'après `docs/AUDIT_REPORT.md`, les stubs suivants peuvent provoquer des pages vides ou des middlewares pass-through dans l'app générée :
- `emit-next.ts` ne consomme pas encore `contract.forms/actions/dataBindings` (P1).
- `emit-hono.ts` génère des middlewares de policy en stubs (P1).
- `emit-auth.ts` génère la config Better Auth mais pas le handler `/api/auth/*` complet (P1).
- Les tests générés (`emit-tests.ts`) sont des stubs — l'étape "run-generated-tests" sera skipped (P1).

Ces stubs produisent une app qui démarre mais avec des fonctionnalités incomplètes. Signaler chaque stub rencontré plutôt que de le silencer.

## Source of truth

`docs/HARNESS.md` §generate-app · `docs/CODEGEN.md` · `docs/AUDIT_REPORT.md`

## AI usage

Copier le prompt, remplacer `<PROJECT_ID>` par l'ID réel. Toujours attendre la confirmation à l'étape 3 avant d'écrire. Documenter les stubs rencontrés dans les `OpenQuestion` du projet.

## Status

Stable — les stubs P1 listés ci-dessus sont des limitations connues, pas des bloquants de génération.
