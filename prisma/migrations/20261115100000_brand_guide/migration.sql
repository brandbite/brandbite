-- CreateEnum
CREATE TYPE "BrandAssetKind" AS ENUM ('LOGO_PRIMARY', 'LOGO_SECONDARY', 'LOGO_ICON', 'LOGO_WORDMARK', 'GUIDELINES', 'OTHER');

-- CreateEnum
CREATE TYPE "BrandAssetBackground" AS ENUM ('ANY', 'LIGHT', 'DARK');

-- CreateEnum
CREATE TYPE "BrandAssetStatus" AS ENUM ('UPLOADING', 'READY', 'FAILED');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "brandId" TEXT;

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "tagline" TEXT,
    "description" TEXT,
    "audience" TEXT,
    "values" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "references" TEXT,
    "toneWords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "voiceNotes" TEXT,
    "voiceDo" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "voiceDont" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "wordsToUse" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "wordsToAvoid" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sampleCopy" TEXT,
    "colors" JSONB NOT NULL DEFAULT '[]',
    "fonts" JSONB NOT NULL DEFAULT '[]',
    "imageryNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandAsset" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "kind" "BrandAssetKind" NOT NULL,
    "background" "BrandAssetBackground" NOT NULL DEFAULT 'ANY',
    "label" TEXT,
    "name" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "mimeType" TEXT,
    "r2Key" TEXT NOT NULL,
    "status" "BrandAssetStatus" NOT NULL DEFAULT 'UPLOADING',
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "BrandAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Brand_companyId_idx" ON "Brand"("companyId");

-- CreateIndex
CREATE INDEX "BrandAsset_brandId_status_idx" ON "BrandAsset"("brandId", "status");

-- CreateIndex
CREATE INDEX "Project_brandId_idx" ON "Project"("brandId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Brand" ADD CONSTRAINT "Brand_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandAsset" ADD CONSTRAINT "BrandAsset_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandAsset" ADD CONSTRAINT "BrandAsset_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "UserAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- One default brand per company (Prisma can't express a partial unique index).
CREATE UNIQUE INDEX "Brand_companyId_default_key" ON "Brand"("companyId") WHERE "isDefault";
