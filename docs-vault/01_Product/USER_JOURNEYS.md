# USER_JOURNEYS

Quatre parcours concrets illustrent comment DTFS est utilise de bout en bout. Chaque parcours traverse le pipeline a des points d'entree differents et mobilise des acteurs distincts.

Liens : [[PERSONAS]] · [[PRODUCT_SPEC]] · [[EXECUTION_FLOW]] · [[REQUIREMENTS]]

---

## Parcours A — L'utilisateur metier decrit une app et obtient une preview

**Acteur** : utilisateur metier (non-technique)

**Declencheur** : "Je veux une app de gestion de taches partagees par lien."

1. L'utilisateur saisit sa description en prose dans l'interface DTFS (ou via MCP).
2. L'agent `dtfs-product-analyst` extrait un `ProductSpec` (purpose, personas, goals, glossary).
3. L'agent `dtfs-screen-spec-writer` extrait les `ScreenSpec` pour chaque ecran identifie.
4. Des `OpenQuestion` sont generees pour les points ambigus (ex. : "Les liens partages expirent-ils ?").
5. L'utilisateur repond aux questions ; des `Assumption` couvrent les silences.
6. Un `SpecArtifact` de type SPEC est genere (Markdown lisible par l'utilisateur).
7. L'utilisateur valide le spec.
8. Les `Requirement` sont extraits et mappes sur des concepts Control Plane.
9. Un `DeltaSpec` est valide puis applique via un `ChangeSet`.
10. Les contrats sont compiles (`BackendContract` + `FrontendContract` + `SharedContract`).
11. `validateContracts()` passe — codegen emet les fichiers dans `generated-app/`.
12. L'utilisateur voit la preview de l'app.

**Gates traversees** : clarification gate (Step 5) · validate_spec (Step 9) · validateContracts (Step 11)

---

## Parcours B — Le developpeur affine via DeltaSpec et ChangeSet

**Acteur** : developpeur

**Declencheur** : l'app todo existe ; le dev veut ajouter une feature "labels colores sur les items".

1. Le dev cree un `ChangeSet` : `POST /api/projects/:id/changesets { "message": "Add colored labels" }`.
2. Il construit un `DeltaSpec` avec un bucket `creates.attributes` (couleur) et un `creates.forms` (champ de selection).
3. Il appelle `dtfs__validate_spec` — le DeltaSpec est valide (cross-refs OK, DSL OK).
4. Il appelle `dtfs__apply_delta_spec` — les Revisions sont enregistrees dans le ChangeSet.
5. Il commit le ChangeSet : `POST /api/projects/:id/changesets/:csid/commit`.
6. Les contrats sont recompiles (`compile_backend_contract`, `compile_frontend_contract`).
7. `validateContracts()` passe — codegen met a jour les fichiers concernes.
8. Le dev inspecte les `GeneratedArtifact` modifies, lance `pnpm typecheck` sur l'app generee.

**Ce qui se passe si quelque chose va mal** : le dev appelle `dtfs__revert_changeset` — un nouveau ChangeSet inverse est applique, le spec revient a l'etat precedent.

---

## Parcours C — L'agent IA pilote DTFS via MCP

**Acteur** : agent IA (Claude Code ou autre LLM configure avec les MCP tools DTFS)

**Declencheur** : instruction utilisateur — "Ajoute une feature de commentaires sur les taches."

1. L'agent appelle `dtfs__list_projects` pour identifier le projet cible.
2. Il appelle `dtfs__get_project_spec` pour lire le spec courant.
3. Il construit un `DeltaSpec` (entities: Comment, relations, operations: createComment/listComments).
4. Il appelle `dtfs__run_governance_checks` — governance report OK.
5. Il appelle `dtfs__apply_delta_spec` (gate validate_before_apply integre — P0 non encore enforce au moment de l'audit).
6. Il appelle `dtfs__compile_backend_contract` et `dtfs__compile_frontend_contract`.
7. Il appelle `dtfs__validate_contracts` — gate passe.
8. Il appelle `dtfs__generate_app { dryRun: false, trackArtifacts: true }`.
9. Il appelle `dtfs__read_audit_log` pour verifier que les events `apply_delta` et `generate_app` sont bien enregistres.

**Note** : l'agent ne manipule jamais directement la DB Prisma du Control Plane. Tout passe par les MCP tools.

---

## Parcours D — Revert d'un changement

**Acteur** : product owner ou developpeur

**Declencheur** : "La feature billing introduite hier ne doit plus etre la."

1. L'acteur appelle `dtfs__list_history(projectId)` — liste des ChangeSets avec messages.
2. Il identifie le ChangeSet dont le message contient "billing".
3. Il appelle `dtfs__revert_changeset(csid)` — DTFS calcule les operations inverses et les applique dans un nouveau ChangeSet de type REVERT.
4. Le ChangeSet de revert est commite automatiquement.
5. Les contrats sont recompiles depuis le spec restaure.
6. Optionnel : `dtfs__generate_app` regenere les fichiers dans l'etat pre-billing.

**Garantie** : aucune donnee de spec n'est jamais supprimee physiquement — l'historique est permanent. Le revert est lui-meme une Revision dans le log.

---

## Source of truth

`docs/EXECUTION_FLOW.md` · `backend/src/seed-todo.ts` · `backend/src/lib/revert.ts` · `backend/src/mcp.ts`

## AI usage

Ces parcours sont les scenarios de test de bout en bout que les agents doivent etre capables d'executer completement. Le Parcours C est le parcours nominal d'un agent autonome.

## Status

documented
