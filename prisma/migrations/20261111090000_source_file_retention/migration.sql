-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'SOURCE_FILES_EXPIRING';

-- AlterTable
ALTER TABLE "TicketSourceFile" ADD COLUMN     "reminder14SentAt" TIMESTAMP(3),
ADD COLUMN     "reminder3SentAt" TIMESTAMP(3);

