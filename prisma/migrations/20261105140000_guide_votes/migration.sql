-- CreateTable
CREATE TABLE "GuideVote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "helpful" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuideVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GuideVote_audience_slug_idx" ON "GuideVote"("audience", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "GuideVote_userId_audience_slug_key" ON "GuideVote"("userId", "audience", "slug");

-- AddForeignKey
ALTER TABLE "GuideVote" ADD CONSTRAINT "GuideVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
