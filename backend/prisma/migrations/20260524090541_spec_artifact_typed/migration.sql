-- Phase 4 — SpecArtifact : typed columns matching the user schema.
-- Table empty after Phase 0, so RENAME + ALTER TYPE on `kind` is safe.
-- The legacy `SpecArtifactKind` enum type stays in DB (no DROP — Prisma
-- ignores it).

-- kind enum → TEXT (table empty)
ALTER TABLE "dtfs"."SpecArtifact"
  ALTER COLUMN "kind" TYPE TEXT USING "kind"::text;

-- body → content, version → currentVersion (table empty)
ALTER TABLE "dtfs"."SpecArtifact" RENAME COLUMN "body"    TO "content";
ALTER TABLE "dtfs"."SpecArtifact" RENAME COLUMN "version" TO "currentVersion";

-- New columns
ALTER TABLE "dtfs"."SpecArtifact"
  ADD COLUMN "featureKey"  TEXT,
  ADD COLUMN "path"        TEXT,
  ADD COLUMN "contentHash" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "source"      TEXT NOT NULL DEFAULT 'manual';

ALTER TABLE "dtfs"."SpecArtifact"
  ALTER COLUMN "contentHash" DROP DEFAULT;
-- `source` keeps its default ('manual') so omitted POSTs get a sane value.

CREATE INDEX "SpecArtifact_projectId_featureKey_idx"
  ON "dtfs"."SpecArtifact" ("projectId", "featureKey");
