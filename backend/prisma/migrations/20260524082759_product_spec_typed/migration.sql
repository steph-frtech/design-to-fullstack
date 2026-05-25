-- Phase 1 — ProductSpec : typed columns instead of generic JSON placeholder.
-- The table is empty after Phase 0 (no rows yet), so RENAME / ADD are safe.
-- We keep the `data` column from Phase 0 untouched (deprecated, ignored by Prisma).

-- Rename name → title (safe, empty table).
ALTER TABLE "dtfs"."ProductSpec" RENAME COLUMN "name" TO "title";

-- description : required ; the default cleans up after backfilling empty rows
-- (there are no rows, but Postgres requires DEFAULT when adding NOT NULL).
ALTER TABLE "dtfs"."ProductSpec"
  ADD COLUMN "description" TEXT NOT NULL DEFAULT '';
ALTER TABLE "dtfs"."ProductSpec" ALTER COLUMN "description" DROP DEFAULT;

-- Optional + typed JSON columns.
ALTER TABLE "dtfs"."ProductSpec"
  ADD COLUMN "domain"          TEXT,
  ADD COLUMN "targetUsers"     JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN "goals"           JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN "nonGoals"        JSONB,
  ADD COLUMN "personas"        JSONB,
  ADD COLUMN "userJourneys"    JSONB,
  ADD COLUMN "businessObjects" JSONB,
  ADD COLUMN "businessRules"   JSONB,
  ADD COLUMN "glossary"        JSONB,
  ADD COLUMN "assumptions"     JSONB,
  ADD COLUMN "openQuestions"   JSONB;

-- Drop defaults for the two NOT NULL JSON columns (we want explicit values).
ALTER TABLE "dtfs"."ProductSpec" ALTER COLUMN "targetUsers" DROP DEFAULT;
ALTER TABLE "dtfs"."ProductSpec" ALTER COLUMN "goals"       DROP DEFAULT;
