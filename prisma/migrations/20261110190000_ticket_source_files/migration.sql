-- CreateEnum
CREATE TYPE "SourceFileStorage" AS ENUM ('GOOGLE_DRIVE', 'DROPBOX', 'R2');

-- CreateEnum
CREATE TYPE "SourceFileStatus" AS ENUM ('UPLOADING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "TicketSourceFile" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "uploadedById" TEXT,
    "name" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "mimeType" TEXT,
    "storage" "SourceFileStorage" NOT NULL,
    "status" "SourceFileStatus" NOT NULL DEFAULT 'UPLOADING',
    "externalId" TEXT,
    "externalUrl" TEXT,
    "r2Key" TEXT,
    "deleteAfter" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketSourceFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationFolder" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "key" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationFolder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TicketSourceFile_ticketId_status_idx" ON "TicketSourceFile"("ticketId", "status");

-- CreateIndex
CREATE INDEX "TicketSourceFile_storage_deleteAfter_idx" ON "TicketSourceFile"("storage", "deleteAfter");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationFolder_companyId_provider_key_key" ON "IntegrationFolder"("companyId", "provider", "key");

-- AddForeignKey
ALTER TABLE "TicketSourceFile" ADD CONSTRAINT "TicketSourceFile_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketSourceFile" ADD CONSTRAINT "TicketSourceFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "UserAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationFolder" ADD CONSTRAINT "IntegrationFolder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

