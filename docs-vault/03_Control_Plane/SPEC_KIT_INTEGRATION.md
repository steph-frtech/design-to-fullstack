# Spec Kit Integration

Spec Kit est le cadrage **fonctionnel** d'un projet. Le Control Plane est la **vérité exécutable**. Les deux coexistent et se complètent — Spec Kit formalise le quoi et le pourquoi, le Control Plane formalise le comment, générable vers du code.

**Liens** : [[CONTROL_PLANE_MODEL]] · [[DELTA_SPEC]] · [[PROJECT_SPEC]]

## Source of truth

`docs/SPECKIT_INTEGRATION.md` · `backend/src/lib/spec-kit-sync.ts` · `backend/src/concepts/sdd-artifacts.ts` · `backend/prisma/schema.prisma` (modèle `SpecArtifact`)

## AI usage

Le LLM utilise Spec Kit pour s'aligner avec l'utilisateur via des artefacts Markdown lisibles. Il ne passe au Control Plane qu'une fois les artefacts revus et signés. Ne jamais traiter un SpecArtifact comme une source de vérité exécutable — c'est du prose, pas du JSON typé validable.

## Status

V1 — CRUD SpecArtifact + from-prompt + sync disque bidirectionnel présents. `contracts/` non syncé en V1 (listée P1 dans l'AUDIT_REPORT). Pas d'intégration avec la CLI officielle Spec Kit.

---

## La distinction fondamentale

```
Spec Kit                           Control Plane
─────────────────────────────────  ──────────────────────────────────────
Prose Markdown                     JSON typé et validable
Ce que l'humain lit et révise      Ce que la machine compile en code
Ambigu mais compréhensible         Précis et générable
Modifiable directement             Modifiable uniquement via DeltaSpec
Versionné par content + hash       Versionné via ChangeSet / Revision
```

> Spec Kit formalise **le quoi et le pourquoi**.
> Le Control Plane formalise **le comment, générable**.

Sans Spec Kit, le LLM saute de la prose au DeltaSpec. Avec Spec Kit, le LLM produit d'abord des artefacts Markdown que l'humain peut vérifier avant que quoi que ce soit ne compile.

---

## Les artefacts Spec Kit

Chaque artefact correspond à un `SpecArtifact` stocké en base (`kind` libre). Les kinds canoniques sont :

### `constitution`

Principes invariants du projet — priorités non-fonctionnelles, philosophie de design, règles qui doivent rester vraies à travers les itérations. Rarement modifié. C'est le north star du LLM.

```markdown
# Constitution

- Privacy first : aucune PII ne quitte l'appareil de l'utilisateur non chiffrée.
- Sharing is optional : toute liste est privée par défaut.
- Mobile-first responsive design.
- Toutes les actions doivent fonctionner offline-first, puis se synchroniser.
```

### `spec`

Spécification fonctionnelle — ce que le système fait, qui l'utilise, quels flux existent. C'est l'artefact que l'utilisateur révise le plus. Itérer ici avant d'aller plus loin.

```markdown
# Spec — todo-list-multi-user

## Personas
- Solo planner
- Family organizer

## User stories
- En tant que Solo planner, je peux créer une liste privée.
- En tant que Family organizer, je peux partager une liste par lien avec expiration.

## Acceptance criteria
- Un todo peut être ajouté en < 3 secondes.
- Un lien partagé fonctionne sans création de compte.
```

### `plan`

Plan technique — architecture choisie, stack, compromis clés, jalons.

```markdown
# Plan

## Stack
- Frontend : Next.js 16, Tailwind, TanStack Query
- Backend : Hono + Prisma
- DB : Postgres (V1) → DoltPostgres (V3)
- Auth : Session-based (AuthMethod SESSION)

## Jalons
1. Schema + CRUD pour TodoList/TodoItem
2. Flux share-link
3. UI mobile-first pass
4. Codegen + deploy Vercel
```

### `tasks`

Liste ordonnée de tâches, chaque tâche assez petite pour être une création d'Operation/Resource/Screen ou un changement clairement borné.

```markdown
# Tasks

- [ ] T1 Créer Entity `TodoList` avec attrs title, ownerId
- [ ] T2 Créer Entity `TodoItem` avec attrs listId, label, done
- [ ] T3 Créer Resource `todo-lists`
- [ ] T4 Créer Operation `createTodoList`
- [ ] T5 Créer Policy `is-todo-list-owner`
- [ ] T6 Créer Behavior `ownable` sur TodoList
- [ ] T7 Créer Screen `/lists` + Form `newTodoListForm`
- [ ] T8 Créer Entity ShareLink + Operation createShareLink
```

Chaque tâche se mappe proprement à une ou plusieurs entrées dans un DeltaSpec.

### Autres kinds supportés

`research` · `data-model` · `quickstart` · `platform-mapping` · `notes` (et tout kind libre via le champ `kind: String` sur le modèle)

**Note** : `contracts/` est un kind **non syncé sur disque en V1** — le sync bidirectionnel ne couvre pas encore ce kind (listée P1 AUDIT_REPORT).

---

## Modèle SpecArtifact

```prisma
model SpecArtifact {
  id             String   // cuid
  projectId      String   // FK Project
  kind           String   // "constitution" | "spec" | "plan" | "tasks" | ...
  featureKey     String?  // null = artefact projet entier; sinon ex. "todo-share-link"
  path           String?  // chemin disque relatif à project.localPath (sync)
  content        String   // Markdown brut
  contentHash    String   // SHA-256 pour dédup et drift detection
  source         String   // "generated" | "speckit" | "manual"
  currentVersion Int
}
```

Le versioning est porté par `currentVersion` — chaque édition substantielle incrémente la version. Les SpecArtifacts ne passent PAS par le système ChangeSet/Revision (ils versionnent eux-mêmes).

---

## Flux complet — place de Spec Kit dans le pipeline

```
Layer 0 : utilisateur prompt "construis une app todo"
   ↓
Layer 1 (LLM) : extraire ProductSpec → SpecArtifact(constitution)
   ↓
Layer 2 (LLM) : extraire ScreenSpec[] → SpecArtifact(spec)
   ↓
Layer 3 (LLM + user) : résoudre OpenQuestions, logger Assumptions
   ↓
Layer 4 (LLM) : émettre les 4 artefacts SpecArtifact (plan + tasks)
   ↓ — utilisateur révise et édite le Markdown directement —
Layer 5 (LLM) : Tasks → Requirements → RequirementMappings → DeltaSpec
   ↓
Layer 6 : valider → ChangeSet → apply → codegen
```

---

## Sync disque bidirectionnel

Quand `project.localPath` est défini, le système synce les SpecArtifacts avec le disque.

```typescript
import { syncArtifactsFromDisk, syncArtifactsToDisk }
  from "backend/src/lib/spec-kit-sync";
```

- **Disque → DB** : `syncArtifactsFromDisk(projectId)` lit les `.md` depuis `localPath/` et met à jour les SpecArtifact rows si le `contentHash` diffère.
- **DB → Disque** : `syncArtifactsToDisk(projectId)` écrit les SpecArtifact rows vers `localPath/`.

**Limite V1** : `contracts/` n'est pas syncé. Le kind `platform-mapping` non plus (suivi dans l'AUDIT_REPORT P1 — "Spec Kit : ajouter le sync de `contracts/`").

---

## PlatformSpecProposal — le pont vers le Control Plane

La `PlatformSpecProposal` (Phase 6) est la synthèse **read-only** automatisée de ce que le Control Plane DEVRAIT contenir pour une feature, basée sur les Phases 1-5. C'est le maillon entre le Spec Kit fonctionnel et le Control Plane exécutable :

```
SpecArtifact(spec) + ScreenSpec[] + Requirements
  → LLM Phase 6
  → PlatformSpecProposal (DRAFT)
  → Revue humaine (ACCEPTED ou REJECTED)
  → compileProposalToDelta()
  → DeltaSpec
  → validateDeltaSpec()
  → applyDeltaSpec()
  → ChangeSet APPLIED (vérité exécutable)
```

La PlatformSpecProposal est stockée avec `proposal` (Json — les buckets entities/operations/policies/screens/…), `warnings`, `assumptions`, `openQuestions`, `confidenceScore`, `status` (DRAFT/ACCEPTED/REJECTED/APPLIED).

---

## Pourquoi le Control Plane ne remplace pas Spec Kit

Les artefacts Spec Kit sont de la **prose** — lisibles mais ambigus. Le Control Plane est du **JSON typé** — sans ambiguïté, validable, compilable.

Le LLM utilise Spec Kit pour s'aligner avec l'utilisateur. Puis il s'engage vers le Control Plane pour produire réellement du code.

> Spec Kit = alignement humain.
> Control Plane = vérité machine.

---

## État V1 de Spec Kit dans DTFS

Ce qui est implémenté :
- CRUD des SpecArtifact rows (endpoints + MCP tools)
- Création via prompt (`from-prompt`)
- Sync disque bidirectionnel (hors `contracts/`)
- Agents `dtfs-spec-writer`, `dtfs-screen-spec-writer`, `dtfs-requirement-extractor`

Ce qui n'est pas encore implémenté :
- UI viewer/editor des Markdown
- Intégration avec la CLI officielle Spec Kit (shim import)
- Sync du kind `contracts/`
- Resync de la doc avec le vrai modèle SpecArtifact (P2 AUDIT_REPORT)
