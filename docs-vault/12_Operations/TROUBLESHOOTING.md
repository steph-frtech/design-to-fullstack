# Troubleshooting

Pièges connus, erreurs fréquentes et leurs résolutions. Basé sur les incidents réels du projet DTFS.

Liens : [[LOCAL_DEV]] · [[MIGRATIONS]] · [[../10_Agents_MCP_Skills/SAFETY_RULES]] · [[../11_Testing/TEST_STRATEGY]].

## Source of truth

Expérience accumulée + audit DTFS Phase 29. Les erreurs documentées ici ont toutes été rencontrées en pratique.

## AI usage

Les agents peuvent consulter ce document quand ils rencontrent une erreur de runtime ou de configuration. Chaque piège a une cause racine et une résolution précise.

## Status

Actif. Mis à jour à chaque nouvel incident connu.

---

## Pièges connus

### 1. DATABASE_URL manquante pour les tests

**Symptôme :**
```
Error: DATABASE_URL is not set
Error: Can't reach database server at ...
```

**Cause :** `pnpm test` requiert `--env-file=../.env` pour la suite complète. `pnpm test:unit` ne requiert pas de DB.

**Résolution :**
```bash
# S'assurer que ../.env existe et contient DATABASE_URL
cat /data/dev/design-to-fullstack/.env | grep DATABASE_URL

# Lancer depuis backend/
cd backend && pnpm test        # nécessite ../.env avec DATABASE_URL
cd backend && pnpm test:unit   # pas de DB requise
```

**Note :** `codegen.test.ts` importe `db.ts` transitivement — il nécessite `--env-file` même si seuls les emitters déterministes sont testés.

---

### 2. tsx CJS / top-level await

**Symptôme :**
```
SyntaxError: Cannot use import statement in a module
TypeError: Cannot use import statement outside a module
Top-level await is not allowed in commonjs format
```

**Cause :** `tsx` est configuré pour ESM (`--import tsx/esm`) mais un fichier utilise des imports CJS ou du top-level await dans un contexte CommonJS.

**Résolution :**
- Utiliser `--import tsx/esm` dans toutes les commandes node.
- S'assurer que `package.json` du workspace contient `"type": "module"` si nécessaire.
- Pas de `require()` dans les fichiers `.ts`.

```bash
# Correct
node --import tsx/esm --env-file=../.env src/index.ts

# Incorrect (manque tsx/esm)
node --env-file=../.env src/index.ts
```

---

### 3. Gate AI sur `prisma migrate reset`

**Symptôme :** L'agent propose d'exécuter `prisma migrate reset` pour résoudre un problème de migration.

**Cause :** `prisma migrate reset` **supprime toutes les données** et réapplique les migrations depuis zéro.

**Règle :** **NE JAMAIS exécuter sans approbation humaine explicite.** L'agent doit proposer des alternatives :
- `prisma migrate deploy` (applique sans reset)
- `prisma migrate status` (diagnostique)
- Correction manuelle du problème de migration

**Résolution alternative :**
```bash
# Diagnostiquer d'abord
pnpm exec prisma migrate status

# Appliquer en douceur
pnpm exec prisma migrate deploy

# En dernier recours AVEC approbation humaine explicite
pnpm exec prisma migrate reset
```

---

### 4. Répertoires orphelins `/data/dev/<slug>`

**Symptôme :** Répertoires `/data/dev/my-app-slug/` créés par le codegen ou des tests, non nettoyés.

**Cause :** Un ancien run de codegen ou un test E2E a créé un `outDir` sous `/data/dev/` au lieu de `/tmp/`. `resolveSafeOutDir` bloque maintenant les writes dans `/data/dev/design-to-fullstack/` mais pas nécessairement dans d'autres sous-dossiers de `/data/dev/`.

**Résolution :**
```bash
# Lister les répertoires suspects
ls /data/dev/

# Nettoyer manuellement
rm -rf /data/dev/<slug-orphelin>

# Configurer l'outDir correctement
dtfs__set_runtime_target(projectId, { outputDir: "/tmp/generated/<projectId>" })
```

**Prévention :** Toujours utiliser `/tmp/dtfs-<projectId>/` ou `<project.localPath>/generated/` comme `outDir`.

---

### 5. RuntimeTarget absent — génération bloquée

**Symptôme :**
```
Error: RuntimeTarget not found for project <projectId>
```

**Cause :** `dtfs__get_runtime_target` retourne `{source: "default"}` si la table `RuntimeTarget` n'est pas migrée, mais l'orchestrateur peut bloquer si aucun target n'est configuré.

**Résolution :**
```bash
# Option 1 : Configurer le RuntimeTarget
/dtfs:set-runtime <projectId>

# Option 2 : Vérifier si la migration est appliquée
cd backend && pnpm exec prisma migrate status
# Si migration 20260524120000 non appliquée → appliquer avec approbation humaine
```

---

### 6. `protected: true` jamais déclenché

**Symptôme :** Un fichier édité manuellement dans `outDir/` est écrasé sans avertissement par un re-generate.

**Cause :** `ManifestEntry.protected` est codé en dur à `false` dans `codegen/types.ts`. La protection des fichiers manuels n'est pas fonctionnelle en V1.

**Contournement :**
- Toujours faire un dry-run (`dryRun: true`) avant un write.
- Copier les fichiers modifiés manuellement hors de `outDir/` avant de re-générer.
- Attendre la correction P0 (voir audit).

---

### 7. 9 buckets DeltaSpec en `not_implemented_yet`

**Symptôme :**
```
{"bucket": "workflows", "status": "not_implemented_yet"}
```

**Cause :** Les buckets `workflows`, `authMethods`, `assets`, `components`, `forms`, `fields`, `actions`, `dataBindings`, `testScenarios` ne sont pas encore implémentés dans `applyDeltaSpec`.

**Résolution :** Éviter ces buckets dans les DeltaSpec jusqu'à leur implémentation. Utiliser uniquement les buckets `entities`, `attributes`, `relations`, `resources`, `operations`, `policies`, `screens`, `productSpecs`, `screenSpecs`, `requirements`.

---

### 8. Erreur DTFS_AUDIT_DB=1 sans migration Phase 10

**Symptôme :**
```
Error: Column 'action' does not exist on table 'AuditLog'
```

**Cause :** `DTFS_AUDIT_DB=1` est défini mais la migration `20260524110000_phase_10_enriched_models` n'a pas été appliquée.

**Résolution :**
- Désactiver `DTFS_AUDIT_DB` (ou le retirer du `.env`).
- Ou appliquer la migration Phase 10 avec approbation humaine.

Le JSONL fallback (`/tmp/dtfs-audit.jsonl`) fonctionne toujours sans la migration.

---

### 9. Conflit de ports entre Control Plane et app générée

**Symptôme :** `Error: listen EADDRINUSE: address already in use :::4000`

**Cause :** Le Control Plane DTFS et l'app générée utilisent le même port.

**Résolution :**
- Control Plane : `:4002` (ou autre port dans `.env`)
- App générée : `:4000` (port par défaut)
- Configurer via `PORT` dans `.env` du Control Plane.

---

### 10. Projet `__test_eph_*` non nettoyé après test E2E

**Symptôme :** Des projets `__test_eph_<timestamp>` persistent en base après un test E2E avorté.

**Cause :** Le test a crashé avant le `finally` block ou le `finally` n'a pas pu se connecter à la DB.

**Résolution :**
```sql
-- Nettoyer les projets de test orphelins
DELETE FROM "Project" WHERE slug LIKE '__test_eph_%';
-- La suppression cascade sur tous les enfants (FK avec onDelete: Cascade)
```

```bash
# Ou via Prisma Studio
pnpm --filter backend db:studio
# → chercher les projets avec slug = __test_eph_*
```
