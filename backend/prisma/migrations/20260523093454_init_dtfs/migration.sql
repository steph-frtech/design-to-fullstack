
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "dtfs";

-- CreateEnum
CREATE TYPE "dtfs"."FieldType" AS ENUM ('TEXT', 'TEXTAREA', 'EMAIL', 'PASSWORD', 'NUMBER', 'DATE', 'DATETIME', 'TIME', 'CHECKBOX', 'RADIO', 'SELECT', 'MULTISELECT', 'FILE', 'RICHTEXT', 'COLOR', 'RANGE', 'HIDDEN', 'CUSTOM');

-- CreateEnum
CREATE TYPE "dtfs"."RevisionOp" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'RESTORE');

-- CreateTable
CREATE TABLE "dtfs"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dtfs"."Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dtfs"."Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "idToken" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dtfs"."Verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dtfs"."Locale" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Locale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dtfs"."TextKey" (
    "id" TEXT NOT NULL,
    "namespace" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TextKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dtfs"."Translation" (
    "id" TEXT NOT NULL,
    "textKeyId" TEXT NOT NULL,
    "localeId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Translation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dtfs"."Project" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nameKey" TEXT,
    "ownerId" TEXT NOT NULL,
    "defaultLocaleId" TEXT NOT NULL,
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dtfs"."ProjectLocale" (
    "projectId" TEXT NOT NULL,
    "localeId" TEXT NOT NULL,

    CONSTRAINT "ProjectLocale_pkey" PRIMARY KEY ("projectId","localeId")
);

-- CreateTable
CREATE TABLE "dtfs"."Theme" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "tokens" JSONB NOT NULL DEFAULT '{}',
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Theme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dtfs"."Entity" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT,
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Entity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dtfs"."Attribute" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "dtfs"."FieldType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "unique" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB NOT NULL DEFAULT '{}',
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attribute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dtfs"."EntityRecord" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EntityRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dtfs"."Screen" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "titleKey" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Screen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dtfs"."Component" (
    "id" TEXT NOT NULL,
    "screenId" TEXT,
    "parentId" TEXT,
    "type" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "config" JSONB NOT NULL DEFAULT '{}',
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Component_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dtfs"."Form" (
    "id" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "entityId" TEXT,
    "submitKey" TEXT,
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Form_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dtfs"."Field" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "dtfs"."FieldType" NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "defaultValue" TEXT,
    "labelKey" TEXT,
    "placeholderKey" TEXT,
    "helpKey" TEXT,
    "config" JSONB NOT NULL DEFAULT '{}',
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Field_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dtfs"."FieldOption" (
    "id" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "labelKey" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FieldOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dtfs"."Revision" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "op" "dtfs"."RevisionOp" NOT NULL,
    "data" JSONB NOT NULL,
    "diff" JSONB,
    "actorId" TEXT,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Revision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "dtfs"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "dtfs"."Session"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Locale_code_key" ON "dtfs"."Locale"("code");

-- CreateIndex
CREATE UNIQUE INDEX "TextKey_namespace_key" ON "dtfs"."TextKey"("namespace");

-- CreateIndex
CREATE UNIQUE INDEX "Translation_textKeyId_localeId_key" ON "dtfs"."Translation"("textKeyId", "localeId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_slug_key" ON "dtfs"."Project"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Theme_projectId_key" ON "dtfs"."Theme"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Entity_projectId_name_key" ON "dtfs"."Entity"("projectId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Attribute_entityId_name_key" ON "dtfs"."Attribute"("entityId", "name");

-- CreateIndex
CREATE INDEX "EntityRecord_entityId_idx" ON "dtfs"."EntityRecord"("entityId");

-- CreateIndex
CREATE UNIQUE INDEX "Screen_projectId_path_key" ON "dtfs"."Screen"("projectId", "path");

-- CreateIndex
CREATE INDEX "Component_screenId_idx" ON "dtfs"."Component"("screenId");

-- CreateIndex
CREATE INDEX "Component_parentId_idx" ON "dtfs"."Component"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "Form_componentId_key" ON "dtfs"."Form"("componentId");

-- CreateIndex
CREATE UNIQUE INDEX "Field_formId_name_key" ON "dtfs"."Field"("formId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "FieldOption_fieldId_value_key" ON "dtfs"."FieldOption"("fieldId", "value");

-- CreateIndex
CREATE INDEX "Revision_entityType_entityId_idx" ON "dtfs"."Revision"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "Revision_createdAt_idx" ON "dtfs"."Revision"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Revision_entityType_entityId_version_key" ON "dtfs"."Revision"("entityType", "entityId", "version");

-- AddForeignKey
ALTER TABLE "dtfs"."Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "dtfs"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dtfs"."Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "dtfs"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dtfs"."Translation" ADD CONSTRAINT "Translation_textKeyId_fkey" FOREIGN KEY ("textKeyId") REFERENCES "dtfs"."TextKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dtfs"."Translation" ADD CONSTRAINT "Translation_localeId_fkey" FOREIGN KEY ("localeId") REFERENCES "dtfs"."Locale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dtfs"."Project" ADD CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "dtfs"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dtfs"."Project" ADD CONSTRAINT "Project_defaultLocaleId_fkey" FOREIGN KEY ("defaultLocaleId") REFERENCES "dtfs"."Locale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dtfs"."ProjectLocale" ADD CONSTRAINT "ProjectLocale_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "dtfs"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dtfs"."ProjectLocale" ADD CONSTRAINT "ProjectLocale_localeId_fkey" FOREIGN KEY ("localeId") REFERENCES "dtfs"."Locale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dtfs"."Theme" ADD CONSTRAINT "Theme_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "dtfs"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dtfs"."Entity" ADD CONSTRAINT "Entity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "dtfs"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dtfs"."Attribute" ADD CONSTRAINT "Attribute_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "dtfs"."Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dtfs"."EntityRecord" ADD CONSTRAINT "EntityRecord_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "dtfs"."Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dtfs"."Screen" ADD CONSTRAINT "Screen_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "dtfs"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dtfs"."Component" ADD CONSTRAINT "Component_screenId_fkey" FOREIGN KEY ("screenId") REFERENCES "dtfs"."Screen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dtfs"."Component" ADD CONSTRAINT "Component_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "dtfs"."Component"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dtfs"."Form" ADD CONSTRAINT "Form_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "dtfs"."Component"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dtfs"."Form" ADD CONSTRAINT "Form_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "dtfs"."Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dtfs"."Field" ADD CONSTRAINT "Field_formId_fkey" FOREIGN KEY ("formId") REFERENCES "dtfs"."Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dtfs"."FieldOption" ADD CONSTRAINT "FieldOption_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "dtfs"."Field"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dtfs"."Revision" ADD CONSTRAINT "Revision_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "dtfs"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

