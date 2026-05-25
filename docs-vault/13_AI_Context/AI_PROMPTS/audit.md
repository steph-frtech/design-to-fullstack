# Prompt réutilisable — Audit du projet DTFS

Prompt destiné à auditer l'état de conformité du projet DTFS par rapport à son architecture cible. Utiliser comme point de départ, en adaptant le périmètre selon le besoin. Le modèle de référence est `docs/AUDIT_REPORT.md` (audit du 2026-05-25).

Liens : [[../AI_RULES]] · [[../AI_DO_NOT_BREAK]] · [[../AI_PROJECT_BRIEF]]

---

## Prompt

```
Tu es un auditeur d'architecture read-only pour le projet design-to-fullstack (DTFS).
Ta mission : vérifier la conformité du code actuel par rapport à l'architecture cible documentée.

CONTRAINTES IMPÉRATIVES :
- Ne modifie aucun fichier. Mode lecture seule exclusivement.
- Fournis des preuves concrètes : chemins de fichiers + numéros de ligne.
- Légende obligatoire : ✅ conforme · ⚠️ incomplet · ❌ manquant · Priorité P0/P1/P2.

PÉRIMÈTRE À AUDITER (adapter selon besoin) :
1. Garde-fous governance (`backend/src/lib/governance/guardrails.ts`) :
   - Vérifier que `guardValidateBeforeApply` est appelé dans le chemin `applyDeltaSpec`.
   - Vérifier que `ManifestEntry.protected` peut être `true` et bloque réellement l'écrasement.
   - Vérifier que `validateContracts` est un gate bloquant dans `generateApp`.
   - Vérifier que `checkClarificationGate` est activé automatiquement avant génération.

2. Couche contrats (`backend/src/lib/contracts/`) :
   - Les 3 compilateurs (backend, frontend, shared) sont présents et compilent sans erreur.
   - `compile-frontend.ts` produit forms/fields/actions/dataBindings.
   - `emit-next.ts` consomme réellement ces données (pas de stubs).

3. Schéma Prisma (`backend/prisma/schema.prisma`) :
   - `OperationKind.WORKFLOW` : présent ou retiré ?
   - `AuthMethodKind` : doublon `APIKEY`/`API_KEY` résolu ?
   - `GeneratedArtifact` : champs `ownership`, `protected`, `generatedFrom`, `runtimeTargetId` présents ?

4. DeltaSpec apply (`backend/src/lib/delta-spec-apply.ts`) :
   - Combien de buckets sont encore `not_implemented_yet` ?
   - L'apply est-il transactionnel (`$transaction`) ?

5. Dette JSONata (`backend/src/lib/dsl/expr.ts`, `policy.ts`) :
   - Ces fichiers existent-ils encore ? Sont-ils référencés ?

LIVRABLE :
- Tableau de conformité par domaine (statut · fichiers · commentaire · priorité).
- Section "P0 — À corriger avant de continuer".
- Section "P1 — À corriger ensuite".
- Score global estimé (% avancement vs architecture cible).
- Mention explicite : aucune modification effectuée.

RÉFÉRENCE : Comparer avec `docs/AUDIT_REPORT.md` pour mesurer la progression depuis l'audit précédent.
```

---

## Variantes

**Audit ciblé governance uniquement :**
Remplacer le périmètre par : "Audite uniquement la section governance : les 7 guards de `guardrails.ts`, leur wiring dans `applyDeltaSpec` et `generateApp`, et le statut de `ManifestEntry.protected`."

**Audit ciblé codegen frontend :**
Remplacer le périmètre par : "Audite uniquement `emit-next.ts` et `compile-frontend.ts`. Vérifie si forms/actions/dataBindings sont émis dans les pages générées."

## Source of truth

`docs/AUDIT_REPORT.md` (modèle de référence) · `docs/GOVERNANCE.md` · `docs/CODEGEN.md`

## AI usage

Copier le prompt dans une session Claude Code. Adapter le périmètre. Ne pas oublier la contrainte read-only.

## Status

Stable — aligné sur le modèle d'audit 2026-05-25.
