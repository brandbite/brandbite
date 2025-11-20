/*
  Warnings:

  - You are about to drop the column `designerPayoutTokens` on the `JobType` table. All the data in the column will be lost.
  - You are about to drop the column `priceCents` on the `Plan` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[stripeProductId]` on the table `Plan` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[stripePriceId]` on the table `Plan` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "JobType_name_key";

-- DropIndex
DROP INDEX "Plan_name_key";

-- AlterTable
ALTER TABLE "JobType" DROP COLUMN "designerPayoutTokens";

-- AlterTable
ALTER TABLE "Plan" DROP COLUMN "priceCents",
ADD COLUMN     "description" TEXT;

-- CreateTable
CREATE TABLE "TicketComment" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketAssignmentLog" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "designerId" TEXT,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketAssignmentLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TicketComment_ticketId_idx" ON "TicketComment"("ticketId");

-- CreateIndex
CREATE INDEX "TicketComment_authorId_idx" ON "TicketComment"("authorId");

-- CreateIndex
CREATE INDEX "TicketAssignmentLog_ticketId_createdAt_idx" ON "TicketAssignmentLog"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "TicketAssignmentLog_designerId_createdAt_idx" ON "TicketAssignmentLog"("designerId", "createdAt");

-- CreateIndex
CREATE INDEX "TicketAssignmentLog_reason_createdAt_idx" ON "TicketAssignmentLog"("reason", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_stripeProductId_key" ON "Plan"("stripeProductId");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_stripePriceId_key" ON "Plan"("stripePriceId");

-- AddForeignKey
ALTER TABLE "TicketComment" ADD CONSTRAINT "TicketComment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketComment" ADD CONSTRAINT "TicketComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketAssignmentLog" ADD CONSTRAINT "TicketAssignmentLog_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketAssignmentLog" ADD CONSTRAINT "TicketAssignmentLog_designerId_fkey" FOREIGN KEY ("designerId") REFERENCES "UserAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
