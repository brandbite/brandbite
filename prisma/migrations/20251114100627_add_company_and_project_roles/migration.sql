/*
  Warnings:

  - The `roleInCompany` column on the `CompanyMember` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "CompanyRole" AS ENUM ('OWNER', 'PM', 'BILLING', 'MEMBER');

-- CreateEnum
CREATE TYPE "ProjectRole" AS ENUM ('OWNER', 'PM', 'CONTRIBUTOR', 'VIEWER');

-- DropIndex
DROP INDEX "TokenLedger_companyId_idx";

-- DropIndex
DROP INDEX "TokenLedger_createdAt_idx";

-- DropIndex
DROP INDEX "TokenLedger_ticketId_idx";

-- DropIndex
DROP INDEX "TokenLedger_userId_idx";

-- DropIndex
DROP INDEX "Withdrawal_designerId_idx";

-- DropIndex
DROP INDEX "Withdrawal_status_idx";

-- AlterTable
ALTER TABLE "CompanyMember" DROP COLUMN "roleInCompany",
ADD COLUMN     "roleInCompany" "CompanyRole" NOT NULL DEFAULT 'MEMBER';

-- AlterTable
ALTER TABLE "UserAccount" ALTER COLUMN "role" DROP DEFAULT;

-- CreateTable
CREATE TABLE "ProjectMember" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ProjectRole" NOT NULL DEFAULT 'CONTRIBUTOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMember_projectId_userId_key" ON "ProjectMember"("projectId", "userId");

-- CreateIndex
CREATE INDEX "TokenLedger_companyId_createdAt_idx" ON "TokenLedger"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "TokenLedger_userId_createdAt_idx" ON "TokenLedger"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "TokenLedger_ticketId_createdAt_idx" ON "TokenLedger"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "Withdrawal_designerId_createdAt_idx" ON "Withdrawal"("designerId", "createdAt");

-- CreateIndex
CREATE INDEX "Withdrawal_status_createdAt_idx" ON "Withdrawal"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
