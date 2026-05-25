# Prompt réutilisable — Ajouter ou compléter la couche contrats runtime

Prompt pour ajouter un mapping manquant à la couche contrats (BackendContract, FrontendContract, SharedContract) ou pour compléter un émetteur qui consomme des contrats incomplets.

Liens : [[../AI_RULES]] · [[../AI_GENERATION_CHECKLIST]] · [[../AI_DO_NOT_BREAK]]

---

## Contexte architectural

La couche contrats est l'intermédiaire entre la spec Control Plane et le codegen :

```
ProjectSpec (DB)
    ↓
compileSharedContract   → SharedContract  (types Zod, AppType)
compileBackendContract  → BackendContract (routes, auth, policies, assets)
compileFrontendContract → FrontendContract (screens, forms, fields, actions, dataBindings)
    ↓
validateContracts
    ↓
generate_app (emit-hono, emit-next, emit-sdk, emit-prisma, emit-auth...)
```

Fichiers concernés :
- `backend/src/lib/contracts/compile-shared.ts`
- `backend/src/lib/contracts/compile-backend.ts`
- `backend/src/lib/contracts/compile-frontend.ts`
- `backend/src/lib/contracts/validate-contracts.ts`
- `backend/src/lib/contracts/explain-contracts.ts`

---

## Prompt — Ajouter un mapping manquant à un contrat

```
Tu travailles sur le projet DTFS. Ta mission : ajouter le mapping <NOM_ENTITE> à <NOM_CONTRAT>.

CONTRAINTES :
- Ne touche QUE les fichiers dans `backend/src/lib/contracts/` et `backend/src/codegen/`.
- Ne modifie pas le schéma Prisma, les MCP tools, ni aucun fichier frontend/web.
- Chaque modification passe par un DeltaSpec si elle touche la spec projet.
  Pour ajouter un mapping dans le compilateur uniquement : patch direct autorisé.
- Lis d'abord : `docs/AUDIT_REPORT.md` §"Mappings backend/frontend" pour voir l'état actuel.

MAPPING À AJOUTER : <décrire l'entité, ex : "Asset → BackendContract.assets[]">

ÉTAPES ATTENDUES :
1. Lire `compile-backend.ts` (ou `compile-frontend.ts` selon le contrat).
2. Lire le type `BackendContract` (ou `FrontendContract`) dans `compile-*.ts` ou `types.ts`.
3. Identifier où insérer le mapping (après quel bloc existant).
4. Ajouter le mapping de façon minimale (pas d'abstractions supplémentaires).
5. Mettre à jour `validate-contracts.ts` si le nouveau champ doit être validé.
6. Vérifier que `emit-*.ts` peut consommer le nouveau champ (ou créer `emit-<entite>.ts`).
7. Lancer `pnpm typecheck` pour vérifier.

LIVRABLE :
- Liste des fichiers modifiés avec diff minimal.
- Résultat du typecheck.
- Confirmation que `validateContracts` couvre le nouveau champ.
```

---

## Prompt — Connecter un contrat compilé à un émetteur (stubs → réel)

```
Tu travailles sur le projet DTFS. Le contrat `FrontendContract.forms` est compilé
mais `emit-next.ts` ne le consomme pas (stubs). Ta mission : connecter les deux.

CONTRAINTES :
- Ne modifie que `backend/src/codegen/emit-next.ts`.
- Ne change pas la signature de `FrontendContract` (lecture seule).
- Lis d'abord `compile-frontend.ts` pour comprendre la structure de `contract.forms`.
- Mode chirurgical : ajoute seulement ce qui manque, ne refactore pas l'existant.

ÉTAPES :
1. Lire `compile-frontend.ts` pour comprendre `FrontendContract.forms[].fields[]`.
2. Lire `emit-next.ts` pour identifier les pages générées (sections stubs).
3. Pour chaque Screen avec des forms : émettre le JSX correspondant aux champs.
4. Importer les types depuis `SharedContract` (via SDK généré, pas depuis le Control Plane).
5. `pnpm typecheck` doit passer.

LIVRABLE : diff de `emit-next.ts` + résultat typecheck.
```

---

## Mapping actuellement absent (au 2026-05-25)

D'après `docs/AUDIT_REPORT.md` :
- **Asset** : absent de `compile-backend.ts` et aucun `emit-asset.ts` — P1.
- **Theme/Translation** : absent de `compile-frontend.ts` — P1.
- **FrontendContract.forms/actions/dataBindings** : compilés mais non émis dans `emit-next.ts` — P1.
- **Policy → middleware** : `emit-hono.ts` génère des stubs pass-through — P1.

## Source of truth

`backend/src/lib/contracts/` · `backend/src/codegen/` · `docs/AUDIT_REPORT.md` §Mappings

## AI usage

Choisir le prompt selon le besoin (ajout de mapping ou connexion stub → réel). Adapter `<NOM_ENTITE>` et `<NOM_CONTRAT>`.

## Status

Stable — les gaps listés ci-dessus sont des P1 à corriger dans la prochaine itération.
