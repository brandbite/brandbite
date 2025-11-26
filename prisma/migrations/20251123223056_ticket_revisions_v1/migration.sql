/*
  Warnings:

  - You are about to drop the column `roleInCompany` on the `CompanyInvite` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "CompanyInvite" DROP COLUMN "roleInCompany";

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "revisionCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "TicketRevision" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "submittedByDesignerId" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "feedbackByCustomerId" TEXT,
    "feedbackAt" TIMESTAMP(3),
    "feedbackMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TicketRevision_ticketId_version_idx" ON "TicketRevision"("ticketId", "version");

-- CreateIndex
CREATE INDEX "TicketRevision_submittedByDesignerId_submittedAt_idx" ON "TicketRevision"("submittedByDesignerId", "submittedAt");

-- CreateIndex
CREATE INDEX "TicketRevision_feedbackByCustomerId_feedbackAt_idx" ON "TicketRevision"("feedbackByCustomerId", "feedbackAt");

-- CreateIndex
CREATE UNIQUE INDEX "TicketRevision_ticketId_version_key" ON "TicketRevision"("ticketId", "version");

-- CreateIndex
CREATE INDEX "Project_companyId_idx" ON "Project"("companyId");

-- AddForeignKey
ALTER TABLE "TicketRevision" ADD CONSTRAINT "TicketRevision_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketRevision" ADD CONSTRAINT "TicketRevision_submittedByDesignerId_fkey" FOREIGN KEY ("submittedByDesignerId") REFERENCES "UserAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketRevision" ADD CONSTRAINT "TicketRevision_feedbackByCustomerId_fkey" FOREIGN KEY ("feedbackByCustomerId") REFERENCES "UserAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
