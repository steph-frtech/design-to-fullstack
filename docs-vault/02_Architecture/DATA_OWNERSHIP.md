# DATA_OWNERSHIP

Qui possède quelle donnée dans DTFS. La propriété des données détermine dans quelle base elles vivent, qui peut les lire/écrire, et quel système est responsable de leur cycle de vie.

Liens : [[SEPARATION_OF_CONCERNS]] · [[CONTROL_PLANE]] · [[CLIENT_APP_RUNTIME]] · [[SECURITY_MODEL]]

---

## Diagramme des deux bases

```
┌──────────────────────────────────────────────────────────────────┐
│  BASE CONTROL PLANE  (PostgreSQL — schéma dtfs)                  │
│                                                                  │
│  Propriétaire : DTFS Platform                                    │
│  Accès : backend DTFS (backend/src/) via Prisma Control Plane    │
│                                                                  │
│  SPECS & MODÈLE DÉCLARATIF                                       │
│    ProductSpec · ScreenSpec · OpenQuestion · Assumption          │
│    SpecArtifact · Requirement · RequirementMapping               │
│    PlatformSpecProposal                                          │
│    Entity · Attribute · EntityRelation · EntityRecord            │
│    Resource · Operation · Policy · AuthMethod · Secret           │
│    AppRole · Behavior · Workflow · Integration · Trigger         │
│    EventDefinition · Screen · Component · Form · Field           │
│    FieldOption · Action · DataBinding · Asset · Environment      │
│                                                                  │
│  VERSIONING                                                      │
│    ChangeSet · Revision                                          │
│                                                                  │
│  CONTRATS & ARTEFACTS                                            │
│    RuntimeTarget · BackendContract · FrontendContract            │
│    SharedContract · GeneratedArtifact · DeploymentTarget         │
│                                                                  │
│  TESTS & AUDIT                                                   │
│    TestScenario · AuditLog                                       │
│                                                                  │
│  AUTH PLATEFORME DTFS                                            │
│    user (utilisateurs DTFS) · session · account                  │
│    verification · twoFactor (Better Auth DTFS)                   │
└──────────────────────────────────────────────────────────────────┘

                    ║  génère (emit*)
                    ▼

┌──────────────────────────────────────────────────────────────────┐
│  BASE CLIENT APP  (PostgreSQL — schéma gen_<slug>)               │
│                                                                  │
│  Propriétaire : l'app générée (projet DTFS spécifique)           │
│  Accès : apps/api de l'app générée via son propre Prisma client  │
│                                                                  │
│  AUTH APP CLIENTE (Better Auth généré)                           │
│    user · session · account · verification · twoFactor           │
│                                                                  │
│  DONNÉES MÉTIER (générées depuis les Entity du Control Plane)    │
│    ex. : todo_lists · todo_items · share_links                   │
│    (nommage réel = snake_case du nom de l'Entity)                │
│                                                                  │
│  ASSETS (si emit-asset.ts implémenté — P1)                       │
│    métadonnées des fichiers uploadés                             │
└──────────────────────────────────────────────────────────────────┘
```

---

## Règles de propriété

| Donnée | Propriétaire | Base | Accessible depuis |
|---|---|---|---|
| Spec de l'app (Entity, Operation…) | DTFS Platform | Control Plane | MCP tools, backend DTFS |
| Historique des changements | DTFS Platform | Control Plane | MCP tools, AuditLog |
| Fichiers générés (référence) | DTFS Platform | Control Plane (`GeneratedArtifact`) | MCP tools |
| Fichiers générés (contenu) | DTFS Platform | Filesystem `generated-app/` | Développeur, CI/CD |
| Utilisateurs de l'app | App Cliente | Client App DB | App générée uniquement |
| Données métier de l'app | App Cliente | Client App DB | App générée uniquement |
| Secrets de l'app | App Cliente | Variables d'environnement | Runtime de l'app uniquement |
| Credentials DTFS | DTFS Platform | Variables d'environnement | Backend DTFS |

---

## Cycle de vie des données

### Control Plane DB

- **Créées** : via DeltaSpec → ChangeSet → Revisions (seul chemin autorisé).
- **Modifiées** : via DeltaSpec update.
- **"Supprimées"** : via DeltaSpec delete → Revision de suppression dans le ChangeSet ; la suppression est réversible via `revert_changeset`.
- **Conservation** : permanente (aucune suppression physique hors opération explicite de nettoyage admin).

### Client App DB

- **Créées** : par les utilisateurs de l'app via les routes API générées.
- **Modifiées** : par les utilisateurs de l'app.
- **Supprimées** : par les utilisateurs de l'app (règles de la logique métier générée).
- **Conservation** : gérée par l'app cliente elle-même (hors contrôle de DTFS).
- **Réinitialisation** : possible en droppant le schéma `gen_<slug>` et en relançant la génération.

---

## Source of truth

`backend/prisma/schema.prisma` · `docs/GOVERNANCE.md` · `docs/AUDIT_REPORT.md` · `backend/src/codegen/emit-auth.ts`

## AI usage

Un agent qui répond à la question "où se trouve telle donnée ?" doit d'abord déterminer si c'est une donnée de spec/plateforme (Control Plane) ou une donnée runtime de l'app (Client App DB). Les confondre est la source d'erreurs d'architecture les plus graves.

## Status

documented
