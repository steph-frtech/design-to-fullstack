-- Phase 6 — PlatformSpecProposal : read-only synthesis layer between
-- mapping (Phase 5) and apply_spec (V1). Single new table, purely additive.

CREATE TABLE "dtfs"."PlatformSpecProposal" (
  "id"                 TEXT NOT NULL,
  "projectId"          TEXT NOT NULL,
  "featureKey"         TEXT,
  "proposal"           JSONB NOT NULL,
  "warnings"           JSONB NOT NULL DEFAULT '[]'::jsonb,
  "assumptions"        JSONB NOT NULL DEFAULT '[]'::jsonb,
  "openQuestions"      JSONB NOT NULL DEFAULT '[]'::jsonb,
  "confidenceScore"    DOUBLE PRECISION,
  "status"             TEXT NOT NULL DEFAULT 'DRAFT',
  "rationale"          TEXT,
  "appliedChangeSetId" TEXT,
  "currentVersion"     INTEGER NOT NULL DEFAULT 1,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlatformSpecProposal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlatformSpecProposal_projectId_status_idx"
  ON "dtfs"."PlatformSpecProposal" ("projectId", "status");

CREATE INDEX "PlatformSpecProposal_projectId_featureKey_idx"
  ON "dtfs"."PlatformSpecProposal" ("projectId", "featureKey");

ALTER TABLE "dtfs"."PlatformSpecProposal"
  ADD CONSTRAINT "PlatformSpecProposal_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "dtfs"."Project"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
