-- AlterTable
ALTER TABLE "MoodboardItem" ADD COLUMN     "groupId" TEXT,
ADD COLUMN     "locked" BOOLEAN NOT NULL DEFAULT false;
