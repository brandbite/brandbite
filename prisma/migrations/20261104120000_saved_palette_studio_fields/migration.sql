-- Color Studio: design roles and tags on saved palettes. Additive only; existing
-- rows keep their plain hex arrays and are converted when read.
ALTER TABLE "SavedPalette" ADD COLUMN "roles" JSONB;
ALTER TABLE "SavedPalette" ADD COLUMN "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
