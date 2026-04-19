-- Creative ratings: multi-dimensional (quality / communication / speed, each
-- 1..5) submitted by the customer when a ticket transitions to DONE. Admin-only
-- signal; creatives never see their own ratings directly.

-- CreateTable
CREATE TABLE "CreativeRating" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "creativeId" TEXT NOT NULL,
    "ratedByUserId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "quality" INTEGER NOT NULL,
    "communication" INTEGER NOT NULL,
    "speed" INTEGER NOT NULL,
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreativeRating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (one rating per ticket)
CREATE UNIQUE INDEX "CreativeRating_ticketId_key" ON "CreativeRating"("ticketId");

-- CreateIndex
CREATE INDEX "CreativeRating_creativeId_createdAt_idx" ON "CreativeRating"("creativeId", "createdAt");

-- CreateIndex
CREATE INDEX "CreativeRating_companyId_createdAt_idx" ON "CreativeRating"("companyId", "createdAt");

-- AddForeignKey
ALTER TABLE "CreativeRating" ADD CONSTRAINT "CreativeRating_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeRating" ADD CONSTRAINT "CreativeRating_creativeId_fkey" FOREIGN KEY ("creativeId") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeRating" ADD CONSTRAINT "CreativeRating_ratedByUserId_fkey" FOREIGN KEY ("ratedByUserId") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeRating" ADD CONSTRAINT "CreativeRating_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
