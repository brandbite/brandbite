-- AlterTable: add public display-copy columns. All optional so existing
-- rows survive the migration; the landing page falls back to sensible
-- defaults when a column is null.
ALTER TABLE "Plan"
  ADD COLUMN "tagline" TEXT,
  ADD COLUMN "features" JSONB,
  ADD COLUMN "displayCtaLabel" TEXT,
  ADD COLUMN "displaySubtitle" TEXT,
  ADD COLUMN "displayOrder" INTEGER;

-- Backfill the three shipped plans with the copy that was previously
-- hardcoded in app/page.tsx (PLAN_DISPLAY constant). After this, the
-- landing page renders identically without the constant. New plans
-- (Stripe-driven or admin-created) start with NULLs and the renderer
-- falls back to generic placeholders until an admin fills the fields
-- in via /admin/plans.
--
-- Idempotent: only updates rows where the column is currently NULL so
-- re-running the migration on a populated DB is a no-op for these
-- shipped plans, and won't clobber any admin edits made between deploy
-- and a hypothetical re-apply.
UPDATE "Plan"
SET
  "tagline" = COALESCE("tagline", 'Best for startups and solo founders'),
  "features" = COALESCE(
    "features",
    '["1 active creative request at a time", "Unlimited revisions & brand asset storage", "Delivery in 2 to 3 business days per task"]'::jsonb
  ),
  "displayCtaLabel" = COALESCE("displayCtaLabel", 'GET STARTED'),
  "displaySubtitle" = COALESCE("displaySubtitle", '“Pause or cancel anytime.”'),
  "displayOrder" = COALESCE("displayOrder", 0)
WHERE "name" = 'Starter';

UPDATE "Plan"
SET
  "tagline" = COALESCE("tagline", 'Perfect for marketing teams & growing brands'),
  "features" = COALESCE(
    "features",
    '["2 active creative requests simultaneously", "Priority turnaround (1 to 2 business days)", "Slack workspace access for real-time collaboration"]'::jsonb
  ),
  "displayCtaLabel" = COALESCE("displayCtaLabel", 'CHOOSE BRAND'),
  "displaySubtitle" = COALESCE("displaySubtitle", '“Most popular choice for performance teams.”'),
  "displayOrder" = COALESCE("displayOrder", 1)
WHERE "name" = 'Brand';

UPDATE "Plan"
SET
  "tagline" = COALESCE("tagline", 'For agencies and fast-moving creative teams'),
  "features" = COALESCE(
    "features",
    '["Unlimited active requests & team seats", "Dedicated project manager & creative lead", "Custom brand portal + asset library integration"]'::jsonb
  ),
  "displayCtaLabel" = COALESCE("displayCtaLabel", 'GO WITH FULL'),
  "displaySubtitle" = COALESCE("displaySubtitle", '“Best value for high-volume creative production.”'),
  "displayOrder" = COALESCE("displayOrder", 2)
WHERE "name" = 'Full';
