# ChangeSet et Revision

Tout write vers le Control Plane est attribué à un **ChangeSet**. Le ChangeSet groupe des **Revisions** — chaque Revision est un snapshot atomique d'une ligne avec diff. Cette mécanique permet revert, time-travel, et audit complet.

**Liens** : [[DELTA_SPEC]] · [[CONTROL_PLANE_MODEL]] · [[PROJECT_SPEC]]

## Source of truth

`backend/src/changesets.ts` · `backend/src/lib/revert.ts` · `backend/src/lib/spec-snapshot.ts` · `backend/src/lib/changeset-diff.ts` · `docs/CHANGESET_FLOW.md` · `docs/BACKEND_MODEL.md`

## AI usage

Toujours ouvrir un ChangeSet explicite (via `dtfs__begin_changeset`) avant une série de mutations liées. Pour une mutation unique, utiliser le shortcut one-shot `POST /delta-spec/apply`. Ne jamais laisser un ChangeSet en statut DRAFT indéfiniment.

## Status

V1 — begin/commit/discard/revert/revertField/getSpecAt/diffChangeSets tous présents. `getSpecAt` couvre Entity/Attribute/Operation uniquement (Relations/Resources/Policies/Screens vides en V1). Apply non transactionnel en V1 — en cas d'erreur partielle, certaines Revisions peuvent avoir été écrites.

---

## Mandatory gate

> **Pas de ChangeSet ouvert = pas d'écriture.**

Chaque route de mutation sous `/:id/*` est enveloppée par `changeset-middleware.ts` :

- Si le client envoie un header `X-ChangeSet-Id: <csid>` → le middleware lie ce ChangeSet à la requête via `AsyncLocalStorage`.
- Si aucun header → le middleware ouvre un ChangeSet implicite à une Revision avec message `auto: <Method> <Path>`.

La fonction `applyDeltaSpec` appelle `runInChangeSet` en interne — chaque ligne créée/modifiée est liée au ChangeSet actif.

---

## Cycle de vie des statuts

```
DRAFT → APPLIED
DRAFT → (supprimé = discard)
APPLIED → REVERTED
```

---

## Flux obligatoire

```
begin_changeset
  → validate_spec      (lint statique optionnel — aucune écriture DB)
  → apply_spec         (écritures DB, émet Revisions)
  → commit_changeset
  
  OU:
  → discard_changeset  (supprime DRAFT + ses Revisions)
```

**Shortcut one-shot** (open + apply + commit en un appel) :

```
POST /api/projects/:id/delta-spec/apply
body: { deltaSpec, message }
```

---

## Référence des fonctions

| Fonction | Endpoint HTTP | MCP Tool | Description |
|---|---|---|---|
| `beginChangeSet` | `POST /changesets/` | `dtfs__begin_changeset` | Ouvre un ChangeSet DRAFT |
| `validateDeltaSpec` | `POST /delta-spec/validate` | `dtfs__validate_delta_spec` | Lint statique, aucune écriture |
| `applyDeltaSpec` | `POST /changesets/apply` | `dtfs__apply_delta_spec` | Apply tous les buckets en ordre de dépendance, émet Revisions |
| `commitChangeSet` | `POST /changesets/:csId/commit` | `dtfs__commit_changeset` | Marque DRAFT → APPLIED |
| `discardChangeSet` | `DELETE /changesets/:csId` | `dtfs__discard_changeset` | Supprime DRAFT + ses Revisions |
| `revertChangeSet` | `POST /changesets/:csId/revert` | `dtfs__revert_changeset` | Crée un nouveau CS APPLIED avec Revisions inverses |
| `revertRevision` | `POST /revisions/:rid/revert` | `dtfs__revert_revision` | Revert atomique d'une Revision |
| `revertField` | `POST /revisions/:rid/revert-field` | `dtfs__revert_field` | Revert ultra-fin d'un champ |
| `getSpecAt` | `GET /changesets/:csId/spec-at` | — | Snapshot du projet à un ChangeSet donné |
| `diffChangeSets` | `GET /changesets/diff?from=&to=` | — | Diff entre deux ChangeSets |

---

## Endpoints HTTP complets

Toutes les routes sous `/api/projects/:projectId/`.

| Method | Path | Body/Query | Description |
|---|---|---|---|
| POST | `changesets/` | `{ message }` | Ouvre DRAFT |
| POST | `changesets/:csId/commit` | — | Commit DRAFT → APPLIED |
| DELETE | `changesets/:csId` | — | Discard DRAFT |
| POST | `changesets/:csId/revert` | — | Revert APPLIED |
| GET | `changesets/` | `?limit&before` | Liste des ChangeSets |
| GET | `changesets/:csId` | — | Détail + Revisions |
| GET | `changesets/:csId/spec-at` | — | Snapshot du spec au CS |
| GET | `changesets/diff` | `?from=&to=` | Diff entre deux CSs |
| GET | `changesets/spec-at` | `?version=<n>\|latest` | Snapshot par numéro de version |
| POST | `delta-spec/apply` | `{ deltaSpec, message }` | One-shot open+apply+commit |

---

## Flux complet — cycles MCP

### Lecture → modification → commit

```
1. dtfs__get_project_spec(projectId, "md")           # lire l'état courant
2. (LLM produit un DeltaSpec)
3. dtfs__validate_delta_spec(projectId, deltaSpec)   # lint statique
4. (si erreurs → itérer)
5. dtfs__begin_changeset(projectId, "feat: …")       # ouvre DRAFT
6. dtfs__apply_delta_spec(changeSetId, deltaSpec)    # écritures + Revisions
7. dtfs__commit_changeset(changeSetId)               # scelle APPLIED
```

### Revert

```
dtfs__list_history(projectId)
dtfs__describe_changeset(changeSetId)
dtfs__revert_changeset(changeSetId)      # revert tout le CS
dtfs__revert_revision(revisionId)        # revert atomique d'une ligne
dtfs__revert_field(revisionId, "title")  # revert ultra-fin d'un champ
```

---

## Granularité du revert

| Niveau | Mécanisme | Endpoint |
|---|---|---|
| Champ | `Revision.diff[field]` | `POST /revisions/:id/revert-field` |
| Revision (atomique) | Ligne `Revision` | `POST /revisions/:id/revert` |
| ChangeSet (logique) | Ligne `ChangeSet` | `POST /changesets/:csId/revert` |

Les reverts créent un **nouveau** ChangeSet APPLIED avec des Revisions inverses. L'original est marqué REVERTED avec `revertedById` pointant vers le nouveau CS. Les reverts de reverts sont autorisés (redo).

---

## Snapshot historique (getSpecAt)

Retourne l'état du projet tel qu'il était après l'application d'un ChangeSet donné. Utile pour du time-travel ou du debugging.

**Limite V1** : reconstruit seulement Entity + Attribute + Operation. Relations, Resources, Policies, Screens sont des tableaux vides.

```bash
# Par id de ChangeSet
GET /api/projects/:pid/changesets/:csId/spec-at

# Par numéro de version
GET /api/projects/:pid/changesets/spec-at?version=5
GET /api/projects/:pid/changesets/spec-at?version=latest
```

---

## Diff entre ChangeSets (diffChangeSets)

Compare deux ChangeSets par clé `entityType:entityId` :

- `onlyInA` — lignes présentes dans CS A, absentes de CS B
- `onlyInB` — lignes présentes dans CS B, absentes de CS A
- `commonChanged` — lignes présentes dans les deux (non un merge champ par champ en V1)

```bash
GET /api/projects/:pid/changesets/diff?from=<csIdA>&to=<csIdB>
```

---

## Comportement transactionnel (état réel V1)

En V1, `applyDeltaSpec` n'est **pas transactionnel**. En cas d'erreur partielle :

- Les buckets déjà appliqués ont leurs Revisions écrites en base.
- Le ChangeSet reste en statut DRAFT (non committé).
- Le résultat retourne les Revisions écrites + les buckets skipped/en erreur.

Conséquence : un discard après une apply partielle supprime les Revisions DRAFT mais les lignes créées en base peuvent subsister selon la cascade. Ce point est listé P1 dans l'AUDIT_REPORT — wrapping en `$transaction` prévu en V1.x.

---

## Modèle Revision

```typescript
{
  id:          string
  entityType:  string    // ex. "Entity", "Operation", "Screen"
  entityId:    string
  version:     number    // monotone croissant par (entityType, entityId)
  op:          "CREATE" | "UPDATE" | "DELETE" | "RESTORE"
  data:        Json      // snapshot complet post-mutation
  diff:        Json?     // { fieldName: [beforeValue, afterValue] }
  actorId:     string?
  changeSetId: string?
  createdAt:   DateTime
}
```

Append-only : jamais mis à jour ni supprimé (sauf cascade sur ChangeSet DRAFT discard).

---

## Modèle ChangeSet

```typescript
{
  id:           string
  projectId:    string
  message:      string
  actorId:      string?
  status:       "DRAFT" | "APPLIED" | "REVERTED"
  parentId:     string?   // ancêtre dans la chaîne APPLIED
  revertOfId:   string?   // si ce CS est un revert d'un autre
  revertedById: string?   // si ce CS a été revert, par lequel
  appliedAt:    DateTime?
  revertedAt:   DateTime?
}
```
