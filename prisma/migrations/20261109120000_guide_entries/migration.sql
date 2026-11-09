-- CreateEnum
CREATE TYPE "GuideAudience" AS ENUM ('CUSTOMER', 'CREATIVE', 'ADMIN', 'PUBLIC');

-- CreateEnum
CREATE TYPE "GuideCodeStatus" AS ENUM ('IN_SYNC', 'CODE_CHANGED', 'CODE_REMOVED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'SUPPORT_GUIDE_CHANGED';

-- CreateTable
CREATE TABLE "GuideEntry" (
    "id" TEXT NOT NULL,
    "audience" "GuideAudience" NOT NULL,
    "slug" TEXT NOT NULL,
    "fromCode" BOOLEAN NOT NULL DEFAULT false,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "content" JSONB,
    "baseCodeHash" TEXT,
    "codeStatus" "GuideCodeStatus" NOT NULL DEFAULT 'IN_SYNC',
    "notifiedCodeHash" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuideEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GuideEntry_codeStatus_idx" ON "GuideEntry"("codeStatus");

-- CreateIndex
CREATE UNIQUE INDEX "GuideEntry_audience_slug_key" ON "GuideEntry"("audience", "slug");

-- AddForeignKey
ALTER TABLE "GuideEntry" ADD CONSTRAINT "GuideEntry_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "UserAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

