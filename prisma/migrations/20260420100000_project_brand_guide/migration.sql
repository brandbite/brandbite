-- Project-level brand guide fields (D19). All nullable — existing rows keep
-- their current behaviour; filling any field surfaces it to creatives + AI.
ALTER TABLE "Project"
  ADD COLUMN "brandLogoUrl" TEXT,
  ADD COLUMN "brandColors"  TEXT,
  ADD COLUMN "brandFonts"   TEXT,
  ADD COLUMN "brandVoice"   TEXT;
