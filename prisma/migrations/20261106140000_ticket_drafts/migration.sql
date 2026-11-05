-- CreateTable
CREATE TABLE "TicketDraft" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "fields" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketDraftAttachment" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "url" TEXT,
    "mimeType" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "originalName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketDraftAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TicketDraft_createdById_updatedAt_idx" ON "TicketDraft"("createdById", "updatedAt");

-- CreateIndex
CREATE INDEX "TicketDraft_companyId_idx" ON "TicketDraft"("companyId");

-- CreateIndex
CREATE INDEX "TicketDraftAttachment_draftId_idx" ON "TicketDraftAttachment"("draftId");

-- AddForeignKey
ALTER TABLE "TicketDraft" ADD CONSTRAINT "TicketDraft_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketDraft" ADD CONSTRAINT "TicketDraft_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "UserAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketDraftAttachment" ADD CONSTRAINT "TicketDraftAttachment_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "TicketDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;
