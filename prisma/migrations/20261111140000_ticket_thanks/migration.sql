-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'THANKS_RECEIVED';

-- CreateTable
CREATE TABLE "TicketThanks" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "creativeId" TEXT NOT NULL,
    "givenByUserId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketThanks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TicketThanks_ticketId_key" ON "TicketThanks"("ticketId");

-- CreateIndex
CREATE INDEX "TicketThanks_creativeId_createdAt_idx" ON "TicketThanks"("creativeId", "createdAt");

-- AddForeignKey
ALTER TABLE "TicketThanks" ADD CONSTRAINT "TicketThanks_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketThanks" ADD CONSTRAINT "TicketThanks_creativeId_fkey" FOREIGN KEY ("creativeId") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketThanks" ADD CONSTRAINT "TicketThanks_givenByUserId_fkey" FOREIGN KEY ("givenByUserId") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketThanks" ADD CONSTRAINT "TicketThanks_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

