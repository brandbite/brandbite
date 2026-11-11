-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "soundtrackUrl" TEXT;

-- AlterTable
ALTER TABLE "UserAccount" ADD COLUMN     "soundtrackSuggestions" BOOLEAN NOT NULL DEFAULT true;

