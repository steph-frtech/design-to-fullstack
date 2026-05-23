-- Scope TextKey (and transitively Translation) to a Project.
-- Strategy: add nullable projectId, backfill all existing rows to the
-- "demo" project, then make NOT NULL + add FK + swap unique constraint.

-- 1. Add nullable column
ALTER TABLE "dtfs"."TextKey" ADD COLUMN "projectId" TEXT;

-- 2. Backfill: attach every existing TextKey to the demo project
UPDATE "dtfs"."TextKey"
SET "projectId" = (SELECT id FROM "dtfs"."Project" WHERE slug = 'demo' LIMIT 1)
WHERE "projectId" IS NULL;

-- 3. Make the column required
ALTER TABLE "dtfs"."TextKey" ALTER COLUMN "projectId" SET NOT NULL;

-- 4. Foreign key
ALTER TABLE "dtfs"."TextKey"
  ADD CONSTRAINT "TextKey_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "dtfs"."Project"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. Drop the old global unique on namespace; replace with (projectId, namespace)
ALTER TABLE "dtfs"."TextKey" DROP CONSTRAINT IF EXISTS "TextKey_namespace_key";
DROP INDEX IF EXISTS "dtfs"."TextKey_namespace_key";
CREATE UNIQUE INDEX "TextKey_projectId_namespace_key"
  ON "dtfs"."TextKey"("projectId", "namespace");

-- 6. Helpful index for the per-project lookup
CREATE INDEX "TextKey_projectId_idx" ON "dtfs"."TextKey"("projectId");
