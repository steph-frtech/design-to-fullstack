# Migrations

Workflow des migrations Prisma pour le Control Plane DTFS. 14 migrations appliquées. 2 migrations en attente de validation humaine.

Liens : [[LOCAL_DEV]] · [[TROUBLESHOOTING]] · [[../07_Schemas/PRISMA_SCHEMA]] · [[../09_ADR/ADR-0001-use-control-plane]].

## Source of truth

`backend/prisma/migrations/` — historique des migrations. `backend/prisma/schema.prisma` — état actuel.

## AI usage

Les agents ne créent pas de migrations directement. Toute modification de schéma passe par : proposition humaine → `prisma migrate dev` → validation → `prisma migrate deploy`. Le gate IA sur `prisma reset` est actif.

## Status

14 migrations appliquées. 2 migrations pendantes (gate humain requis).

---

## Migrations appliquées (14)

| Migration | Description |
|-----------|-------------|
| `20260524065316_project_metadata` | Métadonnées projet |
| `20260524074433_control_plane_v1` | Control Plane V1 |
| `20260524081444_phase_0_skeleton` | Squelette Phase 0 |
| `20260524082759_product_spec_typed` | ProductSpec typé |
| `20260524083816_screen_spec_typed` | ScreenSpec typé |
| `20260524085127_clarification_typed` | Clarification typée |
| `20260524090541_spec_artifact_typed` | SpecArtifact typé |
| `20260524092941_requirement_mapping_typed` | RequirementMapping typé |
| `20260524100039_platform_spec_proposal` | PlatformSpecProposal |
| `20260524110000_phase_10_enriched_models` | Modèles enrichis Phase 10 (SCHEMA ONLY — voir ci-dessous) |
| `20260524120000_control_plane_v1_3_runtime_contracts` | RuntimeTarget + CompileContract (SCHEMA ONLY) |
| + 3 autres migrations | Détails dans `backend/prisma/migrations/` |

**État de validation Prisma :** `prisma validate` → OK. 0 migration pending.

---

## Migrations pendantes (gate humain)

Ces deux migrations ont été préparées mais **pas appliquées** à la base live :

### 1. `20260524110000_phase_10_enriched_models`

**Contenu :** Ajoute des colonnes à `Action`, `DataBinding`, `AppRole`, `EventDefinition`, `Screen` (titleKey, type).

**Gate :** Revue des breaking changes requise avant application.

**Mitigation :** Le code utilise des `select: {}` explicites pour éviter de requêter les colonnes Phase 10. `compileFrontendContract` et `compileSharedContract` ont des guards de ce type.

### 2. `20260524120000_control_plane_v1_3_runtime_contracts`

**Contenu :** Crée la table `RuntimeTarget` (Phase 25) et `CompileContract` (Phase 26).

**Gate :** Revue du scope Phase 26 requise.

**Mitigation :** `getRuntimeTarget` / `setRuntimeTarget` catchent `P2021` et retournent `source: "default"` sans crasher.

---

## Workflow de migration (développement)

```bash
# 1. Modifier backend/prisma/schema.prisma

# 2. Créer une migration de développement
pnpm --filter backend db:migrate
# → prisma migrate dev
# → Nomme la migration, génère le fichier SQL

# 3. Générer le client Prisma
pnpm --filter backend db:generate

# 4. Vérifier
pnpm --filter backend build  # typecheck
```

---

## Workflow de migration (production / déploiement)

```bash
# Appliquer les migrations sans interaction
pnpm exec prisma migrate deploy
```

---

## Règle : gate AI sur prisma reset

L'IA (Claude Code) ne doit **jamais** exécuter `prisma migrate reset` sans approbation humaine explicite. Cette commande supprime toutes les données.

La règle est documentée dans `docs/GOVERNANCE.md` et dans les règles de sécurité [[../10_Agents_MCP_Skills/SAFETY_RULES]].

---

## Structure des migrations

```
backend/prisma/migrations/
  <timestamp>_<name>/
    migration.sql      # SQL généré par Prisma
  migration_lock.toml  # Lock file (ne pas modifier manuellement)
```

---

## Vérification de cohérence

```bash
cd backend
pnpm exec prisma validate          # Valider le schéma
pnpm exec prisma migrate status    # Voir l'état des migrations
```
