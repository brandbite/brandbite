-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'MOODBOARD_COMMENT';

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "moodboardId" TEXT;

-- CreateTable
CREATE TABLE "MoodboardComment" (
    "id" TEXT NOT NULL,
    "moodboardId" TEXT NOT NULL,
    "itemId" TEXT,
    "threadId" TEXT,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MoodboardComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MoodboardComment_moodboardId_createdAt_idx" ON "MoodboardComment"("moodboardId", "createdAt");

-- CreateIndex
CREATE INDEX "MoodboardComment_threadId_idx" ON "MoodboardComment"("threadId");

-- CreateIndex
CREATE INDEX "MoodboardComment_itemId_idx" ON "MoodboardComment"("itemId");

-- AddForeignKey
ALTER TABLE "MoodboardComment" ADD CONSTRAINT "MoodboardComment_moodboardId_fkey" FOREIGN KEY ("moodboardId") REFERENCES "Moodboard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoodboardComment" ADD CONSTRAINT "MoodboardComment_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "MoodboardItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoodboardComment" ADD CONSTRAINT "MoodboardComment_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "MoodboardComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoodboardComment" ADD CONSTRAINT "MoodboardComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

