-- Phase 2 — ScreenSpec : typed columns matching the user's explicit schema.
-- The table is empty after Phase 0 (no rows), so ADD COLUMN with NOT NULL +
-- DEFAULT is safe. The `screenId` and `data` placeholder columns from Phase 0
-- are kept in DB but Prisma no longer maps them (deprecated).

-- description : required (cleanup DEFAULT after).
ALTER TABLE "dtfs"."ScreenSpec"
  ADD COLUMN "description" TEXT NOT NULL DEFAULT '';
ALTER TABLE "dtfs"."ScreenSpec" ALTER COLUMN "description" DROP DEFAULT;

-- Scalar optionals.
ALTER TABLE "dtfs"."ScreenSpec"
  ADD COLUMN "actor"      TEXT,
  ADD COLUMN "purpose"    TEXT,
  ADD COLUMN "userIntent" TEXT,
  ADD COLUMN "layoutHint" TEXT;

-- JSON optionals.
ALTER TABLE "dtfs"."ScreenSpec"
  ADD COLUMN "components"    JSONB,
  ADD COLUMN "fields"        JSONB,
  ADD COLUMN "actions"       JSONB,
  ADD COLUMN "dataNeeds"     JSONB,
  ADD COLUMN "businessRules" JSONB,
  ADD COLUMN "emptyStates"   JSONB,
  ADD COLUMN "errorStates"   JSONB,
  ADD COLUMN "assumptions"   JSONB,
  ADD COLUMN "openQuestions" JSONB;
