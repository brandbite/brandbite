-- Consultations: OWNER/PM company members request a video consultation with
-- the Brandbite admin. Token-costed; admin schedules out-of-band and pastes
-- the video link into the row.

-- CreateEnum
CREATE TYPE "ConsultationStatus" AS ENUM ('PENDING', 'SCHEDULED', 'COMPLETED', 'CANCELED');

-- CreateTable
CREATE TABLE "Consultation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "preferredTimes" JSONB,
    "timezone" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "videoLink" TEXT,
    "adminNotes" TEXT,
    "tokenCost" INTEGER NOT NULL,
    "status" "ConsultationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Consultation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Consultation_companyId_createdAt_idx" ON "Consultation"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "Consultation_status_createdAt_idx" ON "Consultation"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
