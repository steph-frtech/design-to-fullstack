-- Step 25: Add RuntimeTarget, BackendContract, FrontendContract, SharedContract
-- ADDITIVE ONLY — no DROP, no ALTER ... DROP, no TRUNCATE, no data mutations.

CREATE TABLE "dtfs"."RuntimeTarget" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "backend" JSONB NOT NULL,
    "frontend" JSONB NOT NULL,
    "auth" JSONB NOT NULL,
    "database" JSONB NOT NULL,
    "packageManager" TEXT,
    "runtime" TEXT,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RuntimeTarget_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "dtfs"."BackendContract" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "runtimeTargetId" TEXT,
    "apiBasePath" TEXT NOT NULL DEFAULT '/api',
    "routes" JSONB NOT NULL,
    "schemas" JSONB NOT NULL,
    "middlewares" JSONB,
    "auth" JSONB,
    "errors" JSONB,
    "generatedFrom" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackendContract_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "dtfs"."FrontendContract" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "runtimeTargetId" TEXT,
    "routes" JSONB NOT NULL,
    "pages" JSONB NOT NULL,
    "layouts" JSONB,
    "components" JSONB NOT NULL,
    "forms" JSONB NOT NULL,
    "dataBindings" JSONB NOT NULL,
    "actions" JSONB NOT NULL,
    "authGuards" JSONB,
    "generatedFrom" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FrontendContract_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "dtfs"."SharedContract" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "types" JSONB NOT NULL,
    "schemas" JSONB NOT NULL,
    "apiClient" JSONB,
    "errors" JSONB,
    "events" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SharedContract_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RuntimeTarget_projectId_name_key" ON "dtfs"."RuntimeTarget"("projectId", "name");

ALTER TABLE "dtfs"."RuntimeTarget"
    ADD CONSTRAINT "RuntimeTarget_projectId_fkey"
    FOREIGN KEY ("projectId")
    REFERENCES "dtfs"."Project"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
