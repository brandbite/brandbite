/*
  Warnings:

  - Added the required column `designerPayoutTokens` to the `JobType` table without a default value. This is not possible if the table is not empty.
  - Added the required column `priceCents` to the `Plan` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "JobType" ADD COLUMN     "designerPayoutTokens" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "priceCents" INTEGER NOT NULL;
