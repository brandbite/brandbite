-- AlterTable
ALTER TABLE "TicketRevision" ADD COLUMN     "designerMessage" TEXT;

-- AlterTable
ALTER TABLE "UserAccount" ADD COLUMN     "designerRevisionNotesEnabled" BOOLEAN NOT NULL DEFAULT false;
