-- AlterTable
ALTER TABLE "Moodboard" ALTER COLUMN "companyId" DROP NOT NULL,
ADD COLUMN     "sharedWithCustomer" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Moodboard_createdById_idx" ON "Moodboard"("createdById");
