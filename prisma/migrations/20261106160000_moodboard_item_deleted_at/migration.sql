-- AlterTable
ALTER TABLE "MoodboardItem" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "MoodboardItem_deletedAt_idx" ON "MoodboardItem"("deletedAt");
