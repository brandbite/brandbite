-- CreateEnum
CREATE TYPE "AutoAssignMode" AS ENUM ('INHERIT', 'ON', 'OFF');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "autoAssignDefaultEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "autoAssignMode" "AutoAssignMode" NOT NULL DEFAULT 'INHERIT';
