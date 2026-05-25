-- Phase 0 skeleton — 20 placeholder tables for the upstream (NaturalInput,
-- ProductSpec, ScreenSpec, Clarification, Spec Kit, PlatformMapping) and
-- downstream (Codegen, Tests) layers, plus platform additions
-- (Workflow, Asset, AuthMethod, Secret, Environment, AppRole, EventDefinition,
-- Action, DataBinding). Purely additive on dtfs.*. No DROPs, no modifs to
-- existing tables.

-- ─── Enums ────────────────────────────────────────────────────────
CREATE TYPE "dtfs"."SpecArtifactKind" AS ENUM ('CONSTITUTION','SPEC','PLAN','TASKS','NOTES');
CREATE TYPE "dtfs"."AuthMethodKind"   AS ENUM ('SESSION','BEARER','HMAC','APIKEY');

-- ─── Layer 1 — Product Understanding ──────────────────────────────
CREATE TABLE "dtfs"."ProductSpec" (
  "id"             TEXT NOT NULL,
  "projectId"      TEXT NOT NULL,
  "name"           TEXT NOT NULL,
  "data"           JSONB NOT NULL DEFAULT '{}'::jsonb,
  "currentVersion" INTEGER NOT NULL DEFAULT 1,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductSpec_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProductSpec_projectId_idx" ON "dtfs"."ProductSpec"("projectId");

-- ─── Layer 2 — Screen Understanding ───────────────────────────────
CREATE TABLE "dtfs"."ScreenSpec" (
  "id"             TEXT NOT NULL,
  "projectId"      TEXT NOT NULL,
  "productSpecId"  TEXT,
  "screenId"       TEXT,
  "name"           TEXT NOT NULL,
  "data"           JSONB NOT NULL DEFAULT '{}'::jsonb,
  "currentVersion" INTEGER NOT NULL DEFAULT 1,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ScreenSpec_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ScreenSpec_projectId_idx" ON "dtfs"."ScreenSpec"("projectId");

-- ─── Layer 3 — Clarification ──────────────────────────────────────
CREATE TABLE "dtfs"."OpenQuestion" (
  "id"         TEXT NOT NULL,
  "projectId"  TEXT NOT NULL,
  "target"     JSONB NOT NULL,
  "prompt"     TEXT NOT NULL,
  "status"     TEXT NOT NULL DEFAULT 'OPEN',
  "resolution" JSONB,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OpenQuestion_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OpenQuestion_projectId_idx" ON "dtfs"."OpenQuestion"("projectId");

CREATE TABLE "dtfs"."Assumption" (
  "id"         TEXT NOT NULL,
  "projectId"  TEXT NOT NULL,
  "scope"      JSONB NOT NULL,
  "statement"  TEXT NOT NULL,
  "confidence" TEXT NOT NULL DEFAULT 'MEDIUM',
  "kind"       TEXT NOT NULL DEFAULT 'PRODUCT',
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Assumption_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Assumption_projectId_idx" ON "dtfs"."Assumption"("projectId");

-- ─── Layer 4 — Spec Kit ───────────────────────────────────────────
CREATE TABLE "dtfs"."SpecArtifact" (
  "id"        TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "kind"      "dtfs"."SpecArtifactKind" NOT NULL,
  "body"      TEXT NOT NULL,
  "version"   INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SpecArtifact_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SpecArtifact_projectId_kind_idx" ON "dtfs"."SpecArtifact"("projectId","kind");

-- ─── Layer 5 — Platform Mapping ───────────────────────────────────
CREATE TABLE "dtfs"."Requirement" (
  "id"        TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "source"    JSONB NOT NULL,
  "kind"      TEXT NOT NULL DEFAULT 'FUNCTIONAL',
  "statement" TEXT NOT NULL,
  "priority"  TEXT NOT NULL DEFAULT 'MEDIUM',
  "status"    TEXT NOT NULL DEFAULT 'PROPOSED',
  "data"      JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Requirement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Requirement_projectId_idx" ON "dtfs"."Requirement"("projectId");

CREATE TABLE "dtfs"."RequirementMapping" (
  "id"            TEXT NOT NULL,
  "requirementId" TEXT NOT NULL,
  "targetType"    TEXT NOT NULL,
  "targetId"      TEXT NOT NULL,
  "rationale"     JSONB,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RequirementMapping_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RequirementMapping_requirementId_idx" ON "dtfs"."RequirementMapping"("requirementId");

-- ─── Platform additions ───────────────────────────────────────────
CREATE TABLE "dtfs"."Workflow" (
  "id"             TEXT NOT NULL,
  "projectId"      TEXT NOT NULL,
  "name"           TEXT NOT NULL,
  "inputSchema"    JSONB NOT NULL DEFAULT '{}'::jsonb,
  "steps"          JSONB NOT NULL DEFAULT '[]'::jsonb,
  "durability"     JSONB,
  "bodyHint"       TEXT,
  "currentVersion" INTEGER NOT NULL DEFAULT 1,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Workflow_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Workflow_projectId_name_key" ON "dtfs"."Workflow"("projectId","name");

CREATE TABLE "dtfs"."Asset" (
  "id"             TEXT NOT NULL,
  "projectId"      TEXT NOT NULL,
  "storage"        JSONB NOT NULL,
  "mimeType"       TEXT NOT NULL,
  "sizeBytes"      INTEGER NOT NULL,
  "contentHash"    TEXT NOT NULL,
  "originalName"   TEXT,
  "entityId"       TEXT,
  "attributeName"  TEXT,
  "metadata"       JSONB,
  "currentVersion" INTEGER NOT NULL DEFAULT 1,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Asset_projectId_contentHash_idx" ON "dtfs"."Asset"("projectId","contentHash");

CREATE TABLE "dtfs"."AuthMethod" (
  "id"             TEXT NOT NULL,
  "projectId"      TEXT NOT NULL,
  "name"           TEXT NOT NULL,
  "kind"           "dtfs"."AuthMethodKind" NOT NULL,
  "config"         JSONB NOT NULL,
  "isDefault"      BOOLEAN NOT NULL DEFAULT false,
  "currentVersion" INTEGER NOT NULL DEFAULT 1,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AuthMethod_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AuthMethod_projectId_name_key" ON "dtfs"."AuthMethod"("projectId","name");

CREATE TABLE "dtfs"."Secret" (
  "id"        TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "key"       TEXT NOT NULL,
  "vault"     JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Secret_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Secret_projectId_key_key" ON "dtfs"."Secret"("projectId","key");

CREATE TABLE "dtfs"."Environment" (
  "id"        TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "overrides" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Environment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Environment_projectId_name_key" ON "dtfs"."Environment"("projectId","name");

CREATE TABLE "dtfs"."AppRole" (
  "id"          TEXT NOT NULL,
  "projectId"   TEXT NOT NULL,
  "key"         TEXT NOT NULL,
  "label"       TEXT NOT NULL,
  "permissions" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AppRole_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AppRole_projectId_key_key" ON "dtfs"."AppRole"("projectId","key");

CREATE TABLE "dtfs"."EventDefinition" (
  "id"            TEXT NOT NULL,
  "projectId"     TEXT NOT NULL,
  "name"          TEXT NOT NULL,
  "payloadSchema" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "source"        TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EventDefinition_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EventDefinition_projectId_name_key" ON "dtfs"."EventDefinition"("projectId","name");

-- ─── UI binding ───────────────────────────────────────────────────
CREATE TABLE "dtfs"."Action" (
  "id"          TEXT NOT NULL,
  "projectId"   TEXT NOT NULL,
  "componentId" TEXT,
  "kind"        TEXT NOT NULL,
  "targetType"  TEXT NOT NULL,
  "targetId"    TEXT,
  "data"        JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Action_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Action_projectId_idx" ON "dtfs"."Action"("projectId");

CREATE TABLE "dtfs"."DataBinding" (
  "id"          TEXT NOT NULL,
  "projectId"   TEXT NOT NULL,
  "componentId" TEXT,
  "source"      JSONB NOT NULL,
  "query"       JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DataBinding_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DataBinding_projectId_idx" ON "dtfs"."DataBinding"("projectId");

-- ─── Layer 9 — Codegen ────────────────────────────────────────────
CREATE TABLE "dtfs"."GeneratedArtifact" (
  "id"        TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "kind"      TEXT NOT NULL,
  "path"      TEXT NOT NULL,
  "content"   TEXT NOT NULL,
  "hash"      TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GeneratedArtifact_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "GeneratedArtifact_projectId_path_idx" ON "dtfs"."GeneratedArtifact"("projectId","path");

CREATE TABLE "dtfs"."DeploymentTarget" (
  "id"        TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "kind"      TEXT NOT NULL,
  "config"    JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DeploymentTarget_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DeploymentTarget_projectId_name_key" ON "dtfs"."DeploymentTarget"("projectId","name");

-- ─── Layer 10 — Test & Audit ──────────────────────────────────────
CREATE TABLE "dtfs"."TestScenario" (
  "id"          TEXT NOT NULL,
  "projectId"   TEXT NOT NULL,
  "operationId" TEXT,
  "screenId"    TEXT,
  "name"        TEXT NOT NULL,
  "inputs"      JSONB NOT NULL DEFAULT '{}'::jsonb,
  "expected"    JSONB NOT NULL DEFAULT '{}'::jsonb,
  "mocks"       JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TestScenario_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TestScenario_projectId_idx" ON "dtfs"."TestScenario"("projectId");

CREATE TABLE "dtfs"."AuditLog" (
  "id"        TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "actorId"   TEXT,
  "kind"      TEXT NOT NULL,
  "detail"    JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AuditLog_projectId_createdAt_idx" ON "dtfs"."AuditLog"("projectId","createdAt");

-- ─── Foreign Keys ─────────────────────────────────────────────────
ALTER TABLE "dtfs"."ProductSpec"  ADD CONSTRAINT "ProductSpec_projectId_fkey"  FOREIGN KEY ("projectId") REFERENCES "dtfs"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dtfs"."ScreenSpec"   ADD CONSTRAINT "ScreenSpec_projectId_fkey"   FOREIGN KEY ("projectId") REFERENCES "dtfs"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dtfs"."ScreenSpec"   ADD CONSTRAINT "ScreenSpec_productSpecId_fkey" FOREIGN KEY ("productSpecId") REFERENCES "dtfs"."ProductSpec"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "dtfs"."OpenQuestion" ADD CONSTRAINT "OpenQuestion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "dtfs"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dtfs"."Assumption"   ADD CONSTRAINT "Assumption_projectId_fkey"   FOREIGN KEY ("projectId") REFERENCES "dtfs"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dtfs"."SpecArtifact" ADD CONSTRAINT "SpecArtifact_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "dtfs"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dtfs"."Requirement"  ADD CONSTRAINT "Requirement_projectId_fkey"  FOREIGN KEY ("projectId") REFERENCES "dtfs"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dtfs"."RequirementMapping" ADD CONSTRAINT "RequirementMapping_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "dtfs"."Requirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dtfs"."Workflow"     ADD CONSTRAINT "Workflow_projectId_fkey"     FOREIGN KEY ("projectId") REFERENCES "dtfs"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dtfs"."Asset"        ADD CONSTRAINT "Asset_projectId_fkey"        FOREIGN KEY ("projectId") REFERENCES "dtfs"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dtfs"."AuthMethod"   ADD CONSTRAINT "AuthMethod_projectId_fkey"   FOREIGN KEY ("projectId") REFERENCES "dtfs"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dtfs"."Secret"       ADD CONSTRAINT "Secret_projectId_fkey"       FOREIGN KEY ("projectId") REFERENCES "dtfs"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dtfs"."Environment"  ADD CONSTRAINT "Environment_projectId_fkey"  FOREIGN KEY ("projectId") REFERENCES "dtfs"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dtfs"."AppRole"      ADD CONSTRAINT "AppRole_projectId_fkey"      FOREIGN KEY ("projectId") REFERENCES "dtfs"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dtfs"."EventDefinition" ADD CONSTRAINT "EventDefinition_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "dtfs"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dtfs"."Action"       ADD CONSTRAINT "Action_projectId_fkey"       FOREIGN KEY ("projectId") REFERENCES "dtfs"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dtfs"."DataBinding"  ADD CONSTRAINT "DataBinding_projectId_fkey"  FOREIGN KEY ("projectId") REFERENCES "dtfs"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dtfs"."GeneratedArtifact" ADD CONSTRAINT "GeneratedArtifact_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "dtfs"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dtfs"."DeploymentTarget"  ADD CONSTRAINT "DeploymentTarget_projectId_fkey"  FOREIGN KEY ("projectId") REFERENCES "dtfs"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dtfs"."TestScenario" ADD CONSTRAINT "TestScenario_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "dtfs"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dtfs"."AuditLog"     ADD CONSTRAINT "AuditLog_projectId_fkey"     FOREIGN KEY ("projectId") REFERENCES "dtfs"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dtfs"."AuditLog"     ADD CONSTRAINT "AuditLog_actorId_fkey"       FOREIGN KEY ("actorId")   REFERENCES "dtfs"."User"("id")    ON DELETE SET NULL ON UPDATE CASCADE;
