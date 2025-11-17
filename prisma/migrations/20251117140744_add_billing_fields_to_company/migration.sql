/*
  Warnings:

  - A unique constraint covering the columns `[stripeCustomerId]` on the table `Company` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[stripeSubscriptionId]` on the table `Company` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "BillingStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELED');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "billingStatus" "BillingStatus",
ADD COLUMN     "stripeCustomerId" TEXT,
ADD COLUMN     "stripeSubscriptionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Company_stripeCustomerId_key" ON "Company"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Company_stripeSubscriptionId_key" ON "Company"("stripeSubscriptionId");
