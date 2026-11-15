-- CreateEnum
CREATE TYPE "BrandQuestionnaireStatus" AS ENUM ('OPEN', 'SUBMITTED', 'APPLIED', 'DISMISSED');

-- CreateTable
CREATE TABLE "BrandQuestionnaire" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "createdById" TEXT,
    "recipientNote" TEXT,
    "status" "BrandQuestionnaireStatus" NOT NULL DEFAULT 'OPEN',
    "respondentName" TEXT,
    "respondentRole" TEXT,
    "answers" JSONB,
    "submittedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandQuestionnaire_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BrandQuestionnaire_token_key" ON "BrandQuestionnaire"("token");

-- CreateIndex
CREATE INDEX "BrandQuestionnaire_brandId_status_idx" ON "BrandQuestionnaire"("brandId", "status");

-- AddForeignKey
ALTER TABLE "BrandQuestionnaire" ADD CONSTRAINT "BrandQuestionnaire_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandQuestionnaire" ADD CONSTRAINT "BrandQuestionnaire_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "UserAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

