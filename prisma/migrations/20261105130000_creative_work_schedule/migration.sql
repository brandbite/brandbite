-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'CREATIVE_SCHEDULE_UPDATED';

-- AlterTable
ALTER TABLE "TalentApplication" ADD COLUMN     "workSchedule" JSONB;

-- AlterTable
ALTER TABLE "UserAccount" ADD COLUMN     "workSchedule" JSONB,
ADD COLUMN     "workScheduleUpdatedAt" TIMESTAMP(3);
