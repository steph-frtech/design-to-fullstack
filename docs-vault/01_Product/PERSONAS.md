# PERSONAS

DTFS sert plusieurs types d'acteurs aux besoins distincts. Chaque persona interagit avec la plateforme a une couche differente du pipeline. Les comprendre permet de prioriser les fonctionnalites et de concevoir les bons garde-fous.

Liens : [[PRODUCT_VISION]] · [[USER_JOURNEYS]] · [[REQUIREMENTS]]

---

## 1. Utilisateur metier (Business User)

**Profil** : chef de projet, entrepreneur, product owner non-technique. Decrit une app en prose ou via des maquettes.

**Besoin** : obtenir une app fonctionnelle sans ecrire de code. Veut decrire son intention et voir un resultat concret (preview, prototype, deploiement).

**Interaction avec DTFS** :
- Fournit la description naturelle (Layer 0)
- Repond aux `OpenQuestion` (Layer 3)
- Valide le `SpecArtifact` (Layer 4 — le Spec Markdown qu'il peut lire)
- Voit la preview generee

---

## 2. Product Owner (PO)

**Profil** : responsable produit semi-technique. Maitrise les concepts de specs, requirements, User Stories.

**Besoin** : structurer precisement ce qui doit etre construit. Veut des specs tracables, des requirements mappes, un historique reversible.

**Interaction avec DTFS** :
- Cree et affine les `Requirement` (Layer 5)
- Valide les `RequirementMapping`
- Exploite l'historique des ChangeSets pour auditer les decisions
- Peut provoquer un revert si une direction est abandonnee

---

## 3. Developpeur

**Profil** : ingenieur full-stack qui reprend le code genere pour le maintenir, l'etendre ou le deployer.

**Besoin** : code lisible, type, sans magie. Peut modifier le code genere sans casser la regeneration (fichiers marques `protected`).

**Interaction avec DTFS** :
- Lit les `GeneratedArtifact` (Layer 9)
- Utilise les commandes de typecheck et lint sur l'app generee
- Contribue des `TestScenario` supplementaires (Layer 10)
- Peut marquer des fichiers comme `protected` pour proteger ses modifications manuelles

---

## 4. Agent IA

**Profil** : LLM (Claude, GPT, etc.) pilotant DTFS via les 102 MCP tools enregistres.

**Besoin** : acces structure a chaque etape du pipeline, avec des garde-fous qui empechent les erreurs silencieuses. Ne doit pas pouvoir aller de prompt vers code directement.

**Interaction avec DTFS** :
- Utilise `dtfs__apply_delta_spec`, `dtfs__validate_spec`, `dtfs__generate_app`, etc.
- Respecte les gates de gouvernance (validate avant apply, validateContracts avant codegen)
- Peut lire l'`AuditLog` pour comprendre l'etat courant

---

## 5. Admin plateforme

**Profil** : ops/devops gerant l'instance DTFS (base de donnees, authentification, monitoring).

**Besoin** : isolation des bases (Control Plane DB distinct de Client App DB), gestion des secrets, deploiement de nouvelles versions.

**Interaction avec DTFS** :
- Configure les variables d'environnement (`.env` racine)
- Applique les migrations Prisma (`db:migrate`)
- Surveille l'`AuditLog` JSONL et optionnellement la table `AuditLog` (flag `DTFS_AUDIT_DB=1`)

---

## 6. Generateur de code (Codegen)

**Profil** : composant interne — les emitters (`emit-hono.ts`, `emit-next.ts`, `emit-prisma.ts`, `emit-auth.ts`, `emit-sdk.ts`).

**Besoin** : lire les contrats compiles (BackendContract, FrontendContract, SharedContract) et emettre des fichiers bien formes, typechecks-passing, enregistres comme `GeneratedArtifact`.

**Interaction avec DTFS** :
- N'accede jamais directement au Control Plane Prisma pour generer du code
- Lit uniquement les contrats (apres `validateContracts()`)
- Ecrit dans `generated-app/` et enregistre chaque fichier avec `contentHash`

---

## 7. Application cliente generee (Client App Runtime)

**Profil** : l'app Hono + Next 16 produite par DTFS, deployee pour les utilisateurs finaux.

**Besoin** : sa propre base de donnees PostgreSQL (schema `gen_<slug>`), ses propres tables Better Auth (users, sessions, accounts), isolation totale du Control Plane.

**Interaction avec DTFS** :
- Consomme le `packages/shared` genere (types Zod, SDK type)
- Utilise `apps/api` pour l'API et `apps/web` pour le frontend
- Sa DB ne contient aucune table du Control Plane DTFS

---

## Source of truth

`docs/ARCHITECTURE.md` · `docs/EXECUTION_FLOW.md` · `backend/src/seed-todo.ts` (exemple concret)

## AI usage

Un agent IA qui agit au nom d'un utilisateur metier ne doit pas sauter la clarification gate. Un agent agissant au nom du generateur de code ne doit lire que les contrats, pas le spec brut.

## Status

documented
