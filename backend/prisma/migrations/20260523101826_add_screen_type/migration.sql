-- Add an optional "type" column on Screen (e.g. "web", "mobile", …) so
-- that screens can be grouped within a project. Backfill all existing
-- screens to "web" since the demo only has a /contact web screen.

ALTER TABLE "dtfs"."Screen" ADD COLUMN "type" TEXT;

UPDATE "dtfs"."Screen" SET "type" = 'web' WHERE "type" IS NULL;

CREATE INDEX "Screen_projectId_type_idx" ON "dtfs"."Screen"("projectId", "type");
