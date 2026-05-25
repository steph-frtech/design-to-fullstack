-- Phase 3 — typed columns for OpenQuestion & Assumption, replacing the
-- Phase 0 generic JSON placeholders. The tables are empty after Phase 0
-- (no rows), so RENAME + ADD COLUMN with DEFAULT-then-drop-DEFAULT is safe.
-- Old columns are kept as `legacy*` (renamed, NOT NULL dropped) — Prisma
-- now ignores them. No DROP.

-- ─── OpenQuestion ─────────────────────────────────────────────────
ALTER TABLE "dtfs"."OpenQuestion"
  ALTER COLUMN "target" DROP NOT NULL,
  ALTER COLUMN "prompt" DROP NOT NULL;

ALTER TABLE "dtfs"."OpenQuestion" RENAME COLUMN "target"     TO "legacyTarget";
ALTER TABLE "dtfs"."OpenQuestion" RENAME COLUMN "prompt"     TO "legacyPrompt";
ALTER TABLE "dtfs"."OpenQuestion" RENAME COLUMN "resolution" TO "legacyResolution";

ALTER TABLE "dtfs"."OpenQuestion"
  ADD COLUMN "scope"    TEXT NOT NULL DEFAULT '',
  ADD COLUMN "targetId" TEXT,
  ADD COLUMN "question" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "answer"   TEXT;

ALTER TABLE "dtfs"."OpenQuestion"
  ALTER COLUMN "scope"    DROP DEFAULT,
  ALTER COLUMN "question" DROP DEFAULT;

CREATE INDEX "OpenQuestion_projectId_status_idx" ON "dtfs"."OpenQuestion" ("projectId", "status");

-- ─── Assumption ───────────────────────────────────────────────────
ALTER TABLE "dtfs"."Assumption"
  ALTER COLUMN "scope"     DROP NOT NULL,
  ALTER COLUMN "statement" DROP NOT NULL;

ALTER TABLE "dtfs"."Assumption" RENAME COLUMN "scope"     TO "legacyScope";
ALTER TABLE "dtfs"."Assumption" RENAME COLUMN "statement" TO "legacyStatement";

ALTER TABLE "dtfs"."Assumption"
  ADD COLUMN "scope"    TEXT NOT NULL DEFAULT '',
  ADD COLUMN "targetId" TEXT,
  ADD COLUMN "text"     TEXT NOT NULL DEFAULT '',
  ADD COLUMN "status"   TEXT NOT NULL DEFAULT 'OPEN';

ALTER TABLE "dtfs"."Assumption"
  ALTER COLUMN "scope" DROP DEFAULT,
  ALTER COLUMN "text"  DROP DEFAULT;

CREATE INDEX "Assumption_projectId_scope_idx" ON "dtfs"."Assumption" ("projectId", "scope");
