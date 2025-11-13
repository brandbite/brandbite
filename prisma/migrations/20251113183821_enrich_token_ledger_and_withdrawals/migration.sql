-- AlterTable
ALTER TABLE "TokenLedger" ADD COLUMN     "balanceAfter" INTEGER,
ADD COLUMN     "balanceBefore" INTEGER,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "notes" TEXT;

-- AlterTable
ALTER TABLE "UserAccount" ALTER COLUMN "role" SET DEFAULT 'CUSTOMER';

-- AlterTable
ALTER TABLE "Withdrawal" ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "paidAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "TokenLedger_companyId_idx" ON "TokenLedger"("companyId");

-- CreateIndex
CREATE INDEX "TokenLedger_userId_idx" ON "TokenLedger"("userId");

-- CreateIndex
CREATE INDEX "TokenLedger_ticketId_idx" ON "TokenLedger"("ticketId");

-- CreateIndex
CREATE INDEX "TokenLedger_createdAt_idx" ON "TokenLedger"("createdAt");

-- CreateIndex
CREATE INDEX "Withdrawal_designerId_idx" ON "Withdrawal"("designerId");

-- CreateIndex
CREATE INDEX "Withdrawal_status_idx" ON "Withdrawal"("status");
