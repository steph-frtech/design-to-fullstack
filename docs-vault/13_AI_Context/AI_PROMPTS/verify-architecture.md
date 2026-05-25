# Prompt réutilisable — Vérifier les frontières architecturales DTFS

Prompt pour vérifier que l'architecture respecte les deux invariants critiques : séparation Control Plane vs app cliente, et contrats avant codegen. Utiliser en read-only avant toute opération structurante.

Liens : [[../AI_DO_NOT_BREAK]] · [[../AI_RULES]] · [[../AI_PROJECT_BRIEF]]

---

## Prompt

```
Tu es un vérificateur d'architecture read-only pour le projet DTFS.
Ta mission : vérifier que les frontières architecturales sont respectées dans le code actuel.
Mode lecture seule. Ne modifie aucun fichier.

FRONTIÈRE 1 — Séparation Control Plane vs App Cliente

Vérifie les points suivants et fournis des preuves (chemin + ligne) :

A. Schéma Prisma Control Plane (`backend/prisma/schema.prisma`) :
   - Aucune table applicative de l'app cliente (users finaux, sessions cliente, données métier).
   - Les tables présentes sont bien des tables de pilotage : Project, Entity, Operation, Policy,
     Screen, ChangeSet, GeneratedArtifact, AuditLog, OpenQuestion, Requirement, etc.

B. Codegen Better Auth (`backend/src/codegen/emit-auth.ts`) :
   - Le fichier généré est exclusivement dans `outDir/apps/api/src/auth.ts`.
   - La config Better Auth générée ne pointe pas vers la connexion PostgreSQL du Control Plane.
   - Aucun import depuis `backend/generated/prisma/` dans le fichier Better Auth généré.

C. Émetteur Prisma (`backend/src/codegen/emit-prisma.ts`) :
   - Émet un schéma dans `outDir/`, pas dans `backend/prisma/`.
   - Le schéma émis est basé sur les Entity/Attribute du projet, pas sur le schéma Control Plane.

D. SDK généré (`backend/src/codegen/emit-sdk.ts`) :
   - Importe depuis `SharedContract` ou des types générés, pas directement depuis le schéma Control Plane.

FRONTIÈRE 2 — Contrats avant codegen

Vérifie :

E. `backend/src/codegen/codegen.ts` (fonction `generateApp` ou équivalent) :
   - `compileSharedContract`, `compileBackendContract`, `compileFrontendContract` sont appelés
     avant `emit-*`.
   - `validateContracts` est appelé. Est-il un gate bloquant (throw si `ok: false`) ?
     Si non : signaler comme P0/P1 avec la ligne concernée.
   - `emit-prisma.ts` est documenté comme exception (lit le spec brut) : vérifier que c'est toujours
     intentionnel et documenté.

F. `backend/src/codegen/emit-next.ts` :
   - Consomme-t-il `contract.forms`, `contract.actions`, `contract.dataBindings` ?
   - Ou génère-t-il des pages vides / stubs ? Signaler si stubs.

LIVRABLE :
Pour chaque point A–F :
- ✅ Conforme + preuve (chemin:ligne)
- ⚠️ Partiellement conforme + ce qui manque
- ❌ Violation + chemin:ligne + sévérité (P0/P1/P2)

Conclure par : "Les deux frontières sont [respectées / partiellement respectées / violées]."
Mention obligatoire : aucune modification effectuée.
```

---

## Variante — Vérification rapide (5 minutes)

```
Vérification rapide des frontières DTFS. Read-only.

1. `emit-auth.ts` : le fichier généré va-t-il bien dans outDir/ et non dans backend/ ? (chemin:ligne)
2. `generateApp` : `validateContracts` est-il un gate bloquant ? (chemin:ligne ou "non câblé")
3. `emit-next.ts` : pages vides ou formulaires émis ? (chemin:ligne de la fonction principale)

Réponse en 3 lignes, une par question. Pas de modifications.
```

## Source of truth

`backend/src/codegen/` · `docs/AUDIT_REPORT.md` §"Mappings frontend" et §"Garde-fou Better Auth" · `docs/CODEGEN.md`

## AI usage

Lancer ce prompt avant toute opération de refactoring sur la couche codegen ou avant d'accepter un DeltaSpec qui touche au RuntimeTarget ou aux contrats.

## Status

Stable — les points E (validateContracts non-gate) et F (emit-next stubs) sont des P1 connus au 2026-05-25.
