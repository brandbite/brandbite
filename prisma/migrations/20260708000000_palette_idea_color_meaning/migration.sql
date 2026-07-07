-- Phase 2 color tools: CMS-managed PaletteIdea (curated gallery) and
-- ColorMeaning (encyclopedia). Both additive; mirror ShowcaseWork/BlogPost.
CREATE TABLE "PaletteIdea" (
    "id"          TEXT         NOT NULL,
    "title"       TEXT         NOT NULL,
    "slug"        TEXT         NOT NULL,
    "summary"     TEXT,
    "colors"      JSONB        NOT NULL,
    "tags"        TEXT[]       DEFAULT ARRAY[]::TEXT[],
    "status"      "CmsStatus"  NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "sortOrder"   INTEGER      NOT NULL DEFAULT 0,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaletteIdea_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaletteIdea_slug_key" ON "PaletteIdea"("slug");
CREATE INDEX "PaletteIdea_status_sortOrder_idx" ON "PaletteIdea"("status", "sortOrder");

CREATE TABLE "ColorMeaning" (
    "id"              TEXT         NOT NULL,
    "name"            TEXT         NOT NULL,
    "slug"            TEXT         NOT NULL,
    "hex"             TEXT         NOT NULL,
    "summary"         TEXT,
    "meaning"         TEXT,
    "associations"    TEXT[]       DEFAULT ARRAY[]::TEXT[],
    "samplePalettes"  JSONB,
    "metaTitle"       TEXT,
    "metaDescription" TEXT,
    "status"          "CmsStatus"  NOT NULL DEFAULT 'DRAFT',
    "publishedAt"     TIMESTAMP(3),
    "sortOrder"       INTEGER      NOT NULL DEFAULT 0,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ColorMeaning_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ColorMeaning_slug_key" ON "ColorMeaning"("slug");
CREATE INDEX "ColorMeaning_status_sortOrder_idx" ON "ColorMeaning"("status", "sortOrder");
