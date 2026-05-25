-- Control Plane V1 — 8 new tables (7 concepts + ChangeSet), 6 new enums,
-- modifs to Form and Revision. All scoped to schema "dtfs". No DROPs.

-- ─── Enums ────────────────────────────────────────────────────────
CREATE TYPE "dtfs"."RelationKind" AS ENUM ('ONE_TO_ONE', 'ONE_TO_MANY', 'MANY_TO_MANY');
CREATE TYPE "dtfs"."OperationKind" AS ENUM ('QUERY', 'COMMAND', 'WORKFLOW');
CREATE TYPE "dtfs"."PolicyScope" AS ENUM ('RESOURCE', 'OPERATION', 'ENTITY', 'FIELD');
CREATE TYPE "dtfs"."PolicyEffect" AS ENUM ('ALLOW', 'DENY');
CREATE TYPE "dtfs"."TriggerKind" AS ENUM ('EVENT', 'SCHEDULE', 'WEBHOOK');
CREATE TYPE "dtfs"."ChangeSetStatus" AS ENUM ('DRAFT', 'APPLIED', 'REVERTED');

-- ─── Modifs aux tables existantes ─────────────────────────────────
ALTER TABLE "dtfs"."Form"
  ADD COLUMN "operationId"  TEXT,
  ADD COLUMN "inputMapping" JSONB,
  ADD COLUMN "onSuccess"    JSONB,
  ADD COLUMN "onError"      JSONB;

ALTER TABLE "dtfs"."Revision"
  ADD COLUMN "changeSetId" TEXT;

-- ─── ChangeSet ────────────────────────────────────────────────────
CREATE TABLE "dtfs"."ChangeSet" (
  "id"           TEXT NOT NULL,
  "projectId"    TEXT NOT NULL,
  "message"      TEXT NOT NULL,
  "actorId"      TEXT,
  "status"       "dtfs"."ChangeSetStatus" NOT NULL DEFAULT 'DRAFT',
  "parentId"     TEXT,
  "revertOfId"   TEXT,
  "appliedAt"    TIMESTAMP(3),
  "revertedAt"   TIMESTAMP(3),
  "revertedById" TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChangeSet_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ChangeSet_projectId_createdAt_idx" ON "dtfs"."ChangeSet" ("projectId", "createdAt");

-- ─── EntityRelation ───────────────────────────────────────────────
CREATE TABLE "dtfs"."EntityRelation" (
  "id"             TEXT NOT NULL,
  "projectId"      TEXT NOT NULL,
  "fromEntityId"   TEXT NOT NULL,
  "toEntityId"     TEXT NOT NULL,
  "name"           TEXT NOT NULL,
  "kind"           "dtfs"."RelationKind" NOT NULL,
  "fromField"      TEXT,
  "toField"        TEXT,
  "required"       BOOLEAN NOT NULL DEFAULT false,
  "cascade"        JSONB,
  "currentVersion" INTEGER NOT NULL DEFAULT 1,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EntityRelation_pkey" PRIMARY KEY ("id")
);

-- ─── Resource ─────────────────────────────────────────────────────
CREATE TABLE "dtfs"."Resource" (
  "id"              TEXT NOT NULL,
  "projectId"       TEXT NOT NULL,
  "entityId"        TEXT NOT NULL,
  "name"            TEXT NOT NULL,
  "exposedOps"      JSONB NOT NULL,
  "queryConfig"     JSONB,
  "defaultPolicyId" TEXT,
  "currentVersion"  INTEGER NOT NULL DEFAULT 1,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Resource_projectId_name_key" ON "dtfs"."Resource" ("projectId", "name");

-- ─── Operation ────────────────────────────────────────────────────
CREATE TABLE "dtfs"."Operation" (
  "id"             TEXT NOT NULL,
  "projectId"      TEXT NOT NULL,
  "name"           TEXT NOT NULL,
  "kind"           "dtfs"."OperationKind" NOT NULL,
  "inputSchema"    JSONB NOT NULL,
  "outputSchema"   JSONB,
  "reads"          JSONB,
  "writes"         JSONB,
  "steps"          JSONB NOT NULL,
  "bodyHint"       TEXT,
  "currentVersion" INTEGER NOT NULL DEFAULT 1,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Operation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Operation_projectId_name_key" ON "dtfs"."Operation" ("projectId", "name");

-- ─── Policy ───────────────────────────────────────────────────────
CREATE TABLE "dtfs"."Policy" (
  "id"             TEXT NOT NULL,
  "projectId"      TEXT NOT NULL,
  "name"           TEXT NOT NULL,
  "scope"          "dtfs"."PolicyScope" NOT NULL,
  "resourceId"     TEXT,
  "operationId"    TEXT,
  "entityId"       TEXT,
  "fieldName"      TEXT,
  "effect"         "dtfs"."PolicyEffect" NOT NULL DEFAULT 'ALLOW',
  "rule"           JSONB NOT NULL,
  "currentVersion" INTEGER NOT NULL DEFAULT 1,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Policy_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Policy_projectId_name_key" ON "dtfs"."Policy" ("projectId", "name");

-- ─── Integration ──────────────────────────────────────────────────
CREATE TABLE "dtfs"."Integration" (
  "id"             TEXT NOT NULL,
  "projectId"      TEXT NOT NULL,
  "key"            TEXT NOT NULL,
  "provider"       TEXT NOT NULL,
  "capabilities"   JSONB NOT NULL,
  "configSchema"   JSONB NOT NULL,
  "secretRefs"     JSONB,
  "currentVersion" INTEGER NOT NULL DEFAULT 1,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Integration_projectId_key_key" ON "dtfs"."Integration" ("projectId", "key");

-- ─── Trigger ──────────────────────────────────────────────────────
CREATE TABLE "dtfs"."Trigger" (
  "id"             TEXT NOT NULL,
  "projectId"      TEXT NOT NULL,
  "name"           TEXT NOT NULL,
  "kind"           "dtfs"."TriggerKind" NOT NULL,
  "source"         JSONB NOT NULL,
  "operationId"    TEXT NOT NULL,
  "inputMapping"   JSONB,
  "currentVersion" INTEGER NOT NULL DEFAULT 1,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Trigger_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Trigger_projectId_name_key" ON "dtfs"."Trigger" ("projectId", "name");

-- ─── Behavior ─────────────────────────────────────────────────────
CREATE TABLE "dtfs"."Behavior" (
  "id"             TEXT NOT NULL,
  "projectId"      TEXT NOT NULL,
  "entityId"       TEXT NOT NULL,
  "kind"           TEXT NOT NULL,
  "config"         JSONB NOT NULL DEFAULT '{}',
  "currentVersion" INTEGER NOT NULL DEFAULT 1,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Behavior_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Behavior_projectId_entityId_kind_key" ON "dtfs"."Behavior" ("projectId", "entityId", "kind");

-- ─── Indexes on Revision.changeSetId ──────────────────────────────
CREATE INDEX "Revision_changeSetId_idx" ON "dtfs"."Revision" ("changeSetId");

-- ─── Foreign Keys ─────────────────────────────────────────────────

-- ChangeSet
ALTER TABLE "dtfs"."ChangeSet"
  ADD CONSTRAINT "ChangeSet_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "dtfs"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ChangeSet_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "dtfs"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ChangeSet_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "dtfs"."ChangeSet"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ChangeSet_revertOfId_fkey" FOREIGN KEY ("revertOfId") REFERENCES "dtfs"."ChangeSet"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ChangeSet_revertedById_fkey" FOREIGN KEY ("revertedById") REFERENCES "dtfs"."ChangeSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Revision FK to ChangeSet
ALTER TABLE "dtfs"."Revision"
  ADD CONSTRAINT "Revision_changeSetId_fkey" FOREIGN KEY ("changeSetId") REFERENCES "dtfs"."ChangeSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- EntityRelation
ALTER TABLE "dtfs"."EntityRelation"
  ADD CONSTRAINT "EntityRelation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "dtfs"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "EntityRelation_fromEntityId_fkey" FOREIGN KEY ("fromEntityId") REFERENCES "dtfs"."Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "EntityRelation_toEntityId_fkey" FOREIGN KEY ("toEntityId") REFERENCES "dtfs"."Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Resource
ALTER TABLE "dtfs"."Resource"
  ADD CONSTRAINT "Resource_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "dtfs"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "Resource_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "dtfs"."Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "Resource_defaultPolicyId_fkey" FOREIGN KEY ("defaultPolicyId") REFERENCES "dtfs"."Policy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Operation
ALTER TABLE "dtfs"."Operation"
  ADD CONSTRAINT "Operation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "dtfs"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Policy
ALTER TABLE "dtfs"."Policy"
  ADD CONSTRAINT "Policy_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "dtfs"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "Policy_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "dtfs"."Resource"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Policy_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "dtfs"."Operation"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Policy_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "dtfs"."Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Integration
ALTER TABLE "dtfs"."Integration"
  ADD CONSTRAINT "Integration_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "dtfs"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Trigger
ALTER TABLE "dtfs"."Trigger"
  ADD CONSTRAINT "Trigger_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "dtfs"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "Trigger_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "dtfs"."Operation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Behavior
ALTER TABLE "dtfs"."Behavior"
  ADD CONSTRAINT "Behavior_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "dtfs"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "Behavior_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "dtfs"."Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Form.operationId
ALTER TABLE "dtfs"."Form"
  ADD CONSTRAINT "Form_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "dtfs"."Operation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
