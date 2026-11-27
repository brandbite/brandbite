-- Earlier states of a kept newsletter, and single blocks a company keeps to use again.
-- CreateTable
CREATE TABLE "NewsletterVersion" (
    "id" TEXT NOT NULL,
    "newsletterId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsletterVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsletterSavedBlock" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsletterSavedBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NewsletterVersion_newsletterId_createdAt_idx" ON "NewsletterVersion"("newsletterId", "createdAt");

-- CreateIndex
CREATE INDEX "NewsletterSavedBlock_companyId_createdAt_idx" ON "NewsletterSavedBlock"("companyId", "createdAt");

-- AddForeignKey
ALTER TABLE "NewsletterVersion" ADD CONSTRAINT "NewsletterVersion_newsletterId_fkey" FOREIGN KEY ("newsletterId") REFERENCES "Newsletter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsletterVersion" ADD CONSTRAINT "NewsletterVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "UserAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsletterSavedBlock" ADD CONSTRAINT "NewsletterSavedBlock_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsletterSavedBlock" ADD CONSTRAINT "NewsletterSavedBlock_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "UserAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
