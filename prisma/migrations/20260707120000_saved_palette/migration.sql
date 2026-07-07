-- SavedPalette: user-owned color palettes saved from the public color tools.
-- Not company-scoped — any authenticated user can save; ownership by createdById.
CREATE TABLE "SavedPalette" (
    "id"          TEXT         NOT NULL,
    "name"        TEXT         NOT NULL,
    "colors"      JSONB        NOT NULL,
    "source"      TEXT,
    "createdById" TEXT         NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedPalette_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SavedPalette_createdById_createdAt_idx" ON "SavedPalette"("createdById", "createdAt");

ALTER TABLE "SavedPalette" ADD CONSTRAINT "SavedPalette_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
