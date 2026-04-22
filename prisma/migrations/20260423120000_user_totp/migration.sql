-- AlterTable
ALTER TABLE "UserAccount" ADD COLUMN "totpSecret" TEXT;
ALTER TABLE "UserAccount" ADD COLUMN "totpEnrolledAt" TIMESTAMP(3);
