-- CreateEnum
CREATE TYPE "AssetKind" AS ENUM ('BRIEF_INPUT', 'OUTPUT_IMAGE');

-- CreateEnum
CREATE TYPE "PinStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateTable
CREATE TABLE "OutputSizePreset" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "jobTypeId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'px',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutputSizePreset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketOutputSpec" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "presetId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketOutputSpec_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "revisionId" TEXT,
    "kind" "AssetKind" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "url" TEXT,
    "mimeType" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "originalName" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetPin" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "order" INTEGER NOT NULL,
    "label" TEXT,
    "status" "PinStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetPin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetPinComment" (
    "id" TEXT NOT NULL,
    "pinId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetPinComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OutputSizePreset_jobTypeId_isActive_sortOrder_idx" ON "OutputSizePreset"("jobTypeId", "isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "OutputSizePreset_companyId_jobTypeId_key_key" ON "OutputSizePreset"("companyId", "jobTypeId", "key");

-- CreateIndex
CREATE INDEX "TicketOutputSpec_ticketId_idx" ON "TicketOutputSpec"("ticketId");

-- CreateIndex
CREATE UNIQUE INDEX "TicketOutputSpec_ticketId_presetId_key" ON "TicketOutputSpec"("ticketId", "presetId");

-- CreateIndex
CREATE INDEX "Asset_ticketId_kind_createdAt_idx" ON "Asset"("ticketId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "Asset_revisionId_idx" ON "Asset"("revisionId");

-- CreateIndex
CREATE INDEX "Asset_createdById_createdAt_idx" ON "Asset"("createdById", "createdAt");

-- CreateIndex
CREATE INDEX "AssetPin_assetId_status_idx" ON "AssetPin"("assetId", "status");

-- CreateIndex
CREATE INDEX "AssetPin_createdById_createdAt_idx" ON "AssetPin"("createdById", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AssetPin_assetId_order_key" ON "AssetPin"("assetId", "order");

-- CreateIndex
CREATE INDEX "AssetPinComment_pinId_createdAt_idx" ON "AssetPinComment"("pinId", "createdAt");

-- CreateIndex
CREATE INDEX "AssetPinComment_authorId_createdAt_idx" ON "AssetPinComment"("authorId", "createdAt");

-- AddForeignKey
ALTER TABLE "OutputSizePreset" ADD CONSTRAINT "OutputSizePreset_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutputSizePreset" ADD CONSTRAINT "OutputSizePreset_jobTypeId_fkey" FOREIGN KEY ("jobTypeId") REFERENCES "JobType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketOutputSpec" ADD CONSTRAINT "TicketOutputSpec_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketOutputSpec" ADD CONSTRAINT "TicketOutputSpec_presetId_fkey" FOREIGN KEY ("presetId") REFERENCES "OutputSizePreset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "TicketRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetPin" ADD CONSTRAINT "AssetPin_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetPin" ADD CONSTRAINT "AssetPin_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetPin" ADD CONSTRAINT "AssetPin_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "UserAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetPinComment" ADD CONSTRAINT "AssetPinComment_pinId_fkey" FOREIGN KEY ("pinId") REFERENCES "AssetPin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetPinComment" ADD CONSTRAINT "AssetPinComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
