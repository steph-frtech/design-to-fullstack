-- CreateEnum
CREATE TYPE "dtfs"."SecretRefKind" AS ENUM ('ENV', 'VAULT');

-- CreateEnum
CREATE TYPE "dtfs"."ActionKind" AS ENUM ('OPERATION', 'NAVIGATION', 'EVENT_EMIT', 'EXTERNAL_LINK');

-- CreateEnum
CREATE TYPE "dtfs"."DataBindingSource" AS ENUM ('QUERY', 'OPERATION', 'STATIC');

-- CreateEnum
CREATE TYPE "dtfs"."GeneratedArtifactKind" AS ENUM ('CODE', 'MIGRATION', 'ASSET', 'TEST', 'DOCS');

-- CreateEnum
CREATE TYPE "dtfs"."DeploymentTargetKind" AS ENUM ('DEV', 'STAGING', 'PRODUCTION');

-- CreateEnum
CREATE TYPE "dtfs"."TestScenarioKind" AS ENUM ('UNIT', 'INTEGRATION', 'E2E');

-- CreateEnum
CREATE TYPE "dtfs"."TestScenarioStatus" AS ENUM ('DRAFT', 'ACTIVE', 'FAILING');

-- AlterEnum
ALTER TYPE "dtfs"."AuthMethodKind" ADD VALUE 'API_KEY';

-- DropIndex
DROP INDEX "dtfs"."Assumption_projectId_idx";

-- DropIndex
DROP INDEX "dtfs"."OpenQuestion_projectId_idx";

-- DropIndex
DROP INDEX "dtfs"."RequirementMapping_requirementId_idx";

-- AlterTable (Action — plan.md: name, actionKind, target, config)
ALTER TABLE "dtfs"."Action" ADD COLUMN     "actionKind" "dtfs"."ActionKind",
ADD COLUMN     "config" JSONB,
ADD COLUMN     "name" TEXT,
ADD COLUMN     "target" TEXT;

-- AlterTable (AppRole — plan.md: name, description)
ALTER TABLE "dtfs"."AppRole" ADD COLUMN     "description" TEXT,
ADD COLUMN     "name" TEXT;

-- AlterTable (Asset — plan.md: name, ownerId FK User)
ALTER TABLE "dtfs"."Asset" ADD COLUMN     "name" TEXT,
ADD COLUMN     "ownerId" TEXT;

-- AlterTable (Assumption — drop legacy columns that exist in DB but were removed from schema in prior migrations)
ALTER TABLE "dtfs"."Assumption" DROP COLUMN "confidence",
DROP COLUMN "kind",
DROP COLUMN "legacyScope",
DROP COLUMN "legacyStatement";

-- AlterTable (AuditLog — plan.md: action, entityType, entityId, details)
ALTER TABLE "dtfs"."AuditLog" ADD COLUMN     "action" TEXT,
ADD COLUMN     "details" JSONB,
ADD COLUMN     "entityId" TEXT,
ADD COLUMN     "entityType" TEXT;

-- AlterTable (DataBinding — plan.md: componentFkId FK Component, sourceKind, expr, targetProp)
ALTER TABLE "dtfs"."DataBinding" ADD COLUMN     "componentFkId" TEXT,
ADD COLUMN     "expr" JSONB,
ADD COLUMN     "sourceKind" "dtfs"."DataBindingSource",
ADD COLUMN     "targetProp" TEXT;

-- AlterTable (DeploymentTarget — plan.md: targetKind enum)
ALTER TABLE "dtfs"."DeploymentTarget" ADD COLUMN     "targetKind" "dtfs"."DeploymentTargetKind";

-- AlterTable (Environment — plan.md: config)
ALTER TABLE "dtfs"."Environment" ADD COLUMN     "config" JSONB;

-- AlterTable (EventDefinition — plan.md: schema, description)
ALTER TABLE "dtfs"."EventDefinition" ADD COLUMN     "description" TEXT,
ADD COLUMN     "schema" JSONB;

-- AlterTable (GeneratedArtifact — plan.md: changeSetId, artifactKind, contentHash, sizeBytes, generatedAt)
ALTER TABLE "dtfs"."GeneratedArtifact" ADD COLUMN     "artifactKind" "dtfs"."GeneratedArtifactKind",
ADD COLUMN     "changeSetId" TEXT,
ADD COLUMN     "contentHash" TEXT,
ADD COLUMN     "generatedAt" TIMESTAMP(3),
ADD COLUMN     "sizeBytes" INTEGER;

-- AlterTable (OpenQuestion — drop legacy columns pre-existing in DB)
ALTER TABLE "dtfs"."OpenQuestion" DROP COLUMN "legacyPrompt",
DROP COLUMN "legacyResolution",
DROP COLUMN "legacyTarget";

-- AlterTable (ProductSpec — drop legacy data column pre-existing in DB)
ALTER TABLE "dtfs"."ProductSpec" DROP COLUMN "data";

-- AlterTable (Requirement — drop legacy columns pre-existing in DB)
ALTER TABLE "dtfs"."Requirement" DROP COLUMN "legacyData",
DROP COLUMN "legacyKind",
DROP COLUMN "legacySource",
DROP COLUMN "legacyStatement",
ALTER COLUMN "priority" DROP DEFAULT;

-- AlterTable (RequirementMapping — drop legacy column pre-existing in DB)
ALTER TABLE "dtfs"."RequirementMapping" DROP COLUMN "legacyRationale";

-- AlterTable (ScreenSpec — drop legacy columns pre-existing in DB)
ALTER TABLE "dtfs"."ScreenSpec" DROP COLUMN "data",
DROP COLUMN "screenId";

-- AlterTable (Secret — plan.md: name, refKind, path, description)
ALTER TABLE "dtfs"."Secret" ADD COLUMN     "description" TEXT,
ADD COLUMN     "name" TEXT,
ADD COLUMN     "path" TEXT,
ADD COLUMN     "refKind" "dtfs"."SecretRefKind";

-- AlterTable (TestScenario — plan.md: scenarioKind, steps, expectedResult, scenarioStatus)
ALTER TABLE "dtfs"."TestScenario" ADD COLUMN     "expectedResult" JSONB,
ADD COLUMN     "scenarioKind" "dtfs"."TestScenarioKind",
ADD COLUMN     "scenarioStatus" "dtfs"."TestScenarioStatus" DEFAULT 'DRAFT',
ADD COLUMN     "steps" JSONB;

-- AddForeignKey
ALTER TABLE "dtfs"."Asset" ADD CONSTRAINT "Asset_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "dtfs"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dtfs"."DataBinding" ADD CONSTRAINT "DataBinding_componentFkId_fkey" FOREIGN KEY ("componentFkId") REFERENCES "dtfs"."Component"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dtfs"."GeneratedArtifact" ADD CONSTRAINT "GeneratedArtifact_changeSetId_fkey" FOREIGN KEY ("changeSetId") REFERENCES "dtfs"."ChangeSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
