-- CreateTable
CREATE TABLE "PageBlock" (
    "id" TEXT NOT NULL,
    "pageKey" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PageBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PageBlock_pageKey_idx" ON "PageBlock"("pageKey");

-- CreateIndex
CREATE UNIQUE INDEX "PageBlock_pageKey_position_key" ON "PageBlock"("pageKey", "position");
