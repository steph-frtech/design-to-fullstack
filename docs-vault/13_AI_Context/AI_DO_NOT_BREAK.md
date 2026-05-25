# AI Do Not Break — Invariants à ne jamais casser

Liste des invariants structurels de DTFS. Casser l'un d'eux corrompt soit la traçabilité de la spec, soit la sécurité de l'app générée, soit la gouvernance du pipeline. Aucune optimisation, refactoring ou "amélioration" ne justifie de violer ces invariants.

Liens : [[AI_RULES]] · [[AI_PROJECT_BRIEF]] · [[../03_Control_Plane/GOVERNANCE]]

---

## INV-01 — Séparation des plans (Control Plane vs Client App)

Le Control Plane et l'application cliente générée sont deux systèmes distincts. Ils ne partagent ni schéma de base de données, ni instances Better Auth, ni sessions. Le Control Plane ne contient aucune table métier de l'app cliente. L'app cliente ne contient aucune référence au schéma Control Plane.

Casser cela : mélange de données, violation de confidentialité, impossibilité de générer plusieurs apps sur le même Control Plane.

---

## INV-02 — ChangeSet gate (écriture impossible hors ChangeSet)

Toute mutation de la spécification projet passe par un ChangeSet actif (`begin_changeset` → `apply_delta_spec` → `commit_changeset`). Il n'existe pas de chemin d'écriture légitime qui contourne ce trio.

Casser cela : perte de traçabilité, incapacité à revenir en arrière (`revert_changeset`), audit log incomplet.

---

## INV-03 — Validate-before-apply (spec valide avant toute mutation)

Un DeltaSpec DOIT passer `validateDeltaSpec` avec `ok: true` avant d'être appliqué. Cette règle est actuellement un P0 non-enforced dans le code (voir `docs/AUDIT_REPORT.md`) — la respecter manuellement jusqu'à correction.

Casser cela : entités orphelines, références cassées, schéma Prisma invalide, migrations en erreur.

---

## INV-04 — Isolation Better Auth (sessions client ≠ Control Plane)

Better Auth de l'app cliente est exclusivement dans `outDir/apps/api/src/auth.ts`. Les tables `user`, `session`, `account` de l'app cliente ne sont jamais dans la base Control Plane. Ne pas pointer la config Better Auth générée vers la connexion PostgreSQL du Control Plane.

Casser cela : les utilisateurs finaux de l'app générée auraient accès potentiel aux données de spécification.

---

## INV-05 — Traçabilité GeneratedArtifact (tout fichier généré est tracé)

Chaque fichier produit par `generate_app` en mode non-dryRun doit avoir une entrée `GeneratedArtifact` avec `contentHash`, `path`, et `trackArtifacts: true`. Sans cette traçabilité, il est impossible de détecter les fichiers manuels, de diff deux générations, ou de protéger des fichiers contre l'écrasement.

Casser cela : perte de la capacité à distinguer "généré" vs "manuel", protection des fichiers impossible.

---

## INV-06 — Contrats avant codegen (compile → validate → generate)

Le codegen lit `BackendContract`, `FrontendContract`, `SharedContract` — jamais directement le `projectSpec` brut (sauf `emit-prisma.ts` qui a une exception documentée). L'ordre est immuable : `compile_shared` → `compile_backend` → `compile_frontend` → `validate_contracts` → `generate_app`.

Casser cela : code généré incohérent avec la spec, types TypeScript désynchronisés, routes API manquantes.

---

## INV-07 — Catalogue Expr fermé (8 fonctions, pas plus)

Le catalogue des fonctions Expr est fermé : `lowercase`, `uppercase`, `trim`, `concat`, `length`, `now`, `uuid`, `randomToken`. Ajouter une fonction non listée dans un DeltaSpec est un rejet dur du guard `guardNoUnknownExprFunctions`.

Casser cela : DeltaSpec rejeté à l'apply, opérations invalides en DB, comportement imprévisible à l'évaluation.

---

## INV-08 — Clarification gate avant génération

Si des `OpenQuestion` ou `Assumption` de statut `OPEN` existent pour le projet, la génération de code est interdite. Ce gate est actuellement non-enforced automatiquement (P1) — l'appliquer manuellement.

Casser cela : code généré sur des spécifications ambiguës, fonctionnalités manquantes ou contradictoires.

---

## Source of truth

`docs/GOVERNANCE.md` · `docs/AUDIT_REPORT.md` · `backend/src/lib/governance/guardrails.ts` · `backend/src/lib/changeset-middleware.ts`

## AI usage

Relire cette liste avant tout apply non-dryRun et avant tout generate_app non-dryRun. Si un invariant semble en conflit avec une instruction, l'invariant prime.

## Status

Stable — les INV-03 et INV-05 (protection fichiers) sont des P0 non-corrigés au 2026-05-25.
