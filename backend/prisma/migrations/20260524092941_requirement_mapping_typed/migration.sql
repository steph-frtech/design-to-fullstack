-- Phase 5 — Requirement + RequirementMapping : typed columns matching
-- user's explicit schema. Tables empty after Phase 0, so RENAME + ADD COLUMN
-- additive. No DROP. Old columns kept as `legacy*` (Prisma ignores them).

-- ─── Requirement ──────────────────────────────────────────────────
ALTER TABLE "dtfs"."Requirement"
  ALTER COLUMN "source"    DROP NOT NULL,
  ALTER COLUMN "kind"      DROP NOT NULL,
  ALTER COLUMN "statement" DROP NOT NULL,
  ALTER COLUMN "data"      DROP NOT NULL,
  ALTER COLUMN "priority"  DROP NOT NULL;

ALTER TABLE "dtfs"."Requirement" RENAME COLUMN "source"    TO "legacySource";
ALTER TABLE "dtfs"."Requirement" RENAME COLUMN "kind"      TO "legacyKind";
ALTER TABLE "dtfs"."Requirement" RENAME COLUMN "statement" TO "legacyStatement";
ALTER TABLE "dtfs"."Requirement" RENAME COLUMN "data"      TO "legacyData";

ALTER TABLE "dtfs"."Requirement"
  ADD COLUMN "productSpecId"      TEXT,
  ADD COLUMN "key"                TEXT NOT NULL DEFAULT '',
  ADD COLUMN "title"              TEXT NOT NULL DEFAULT '',
  ADD COLUMN "description"        TEXT NOT NULL DEFAULT '',
  ADD COLUMN "acceptanceCriteria" JSONB,
  ADD COLUMN "source"             TEXT,
  ADD COLUMN "currentVersion"     INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "dtfs"."Requirement"
  ALTER COLUMN "key"         DROP DEFAULT,
  ALTER COLUMN "title"       DROP DEFAULT,
  ALTER COLUMN "description" DROP DEFAULT;

-- Default status PROPOSED → DRAFT (existing column).
ALTER TABLE "dtfs"."Requirement" ALTER COLUMN "status" SET DEFAULT 'DRAFT';

CREATE UNIQUE INDEX "Requirement_projectId_key_key"
  ON "dtfs"."Requirement" ("projectId", "key");

-- ─── RequirementMapping ───────────────────────────────────────────
ALTER TABLE "dtfs"."RequirementMapping"
  ALTER COLUMN "rationale" DROP NOT NULL;

ALTER TABLE "dtfs"."RequirementMapping" RENAME COLUMN "rationale" TO "legacyRationale";

ALTER TABLE "dtfs"."RequirementMapping"
  ADD COLUMN "projectId"  TEXT NOT NULL DEFAULT '',
  ADD COLUMN "confidence" DOUBLE PRECISION,
  ADD COLUMN "rationale"  TEXT;

ALTER TABLE "dtfs"."RequirementMapping"
  ALTER COLUMN "projectId" DROP DEFAULT;

CREATE INDEX "RequirementMapping_projectId_requirementId_idx"
  ON "dtfs"."RequirementMapping" ("projectId", "requirementId");
