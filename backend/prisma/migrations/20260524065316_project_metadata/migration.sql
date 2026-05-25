-- AlterTable: add wizard-captured metadata to Project
ALTER TABLE "dtfs"."Project"
  ADD COLUMN "localPath" TEXT,
  ADD COLUMN "githubRepo" TEXT,
  ADD COLUMN "enabledScreenTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
