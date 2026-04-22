-- CreateTable
CREATE TABLE "WithdrawalApproval" (
    "id" TEXT NOT NULL,
    "withdrawalId" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WithdrawalApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WithdrawalApproval_withdrawalId_approverId_key" ON "WithdrawalApproval"("withdrawalId", "approverId");

-- CreateIndex
CREATE INDEX "WithdrawalApproval_withdrawalId_idx" ON "WithdrawalApproval"("withdrawalId");

-- AddForeignKey
ALTER TABLE "WithdrawalApproval" ADD CONSTRAINT "WithdrawalApproval_withdrawalId_fkey" FOREIGN KEY ("withdrawalId") REFERENCES "Withdrawal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WithdrawalApproval" ADD CONSTRAINT "WithdrawalApproval_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
