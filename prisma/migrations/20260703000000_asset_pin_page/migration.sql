-- AssetPin: add 1-based `page` for PDF pinning. Images are single-page and
-- existing pins are all image pins, so default 1 keeps every current row
-- valid with no backfill. Additive, zero-risk.
ALTER TABLE "AssetPin" ADD COLUMN "page" INTEGER NOT NULL DEFAULT 1;
