-- Distinguish recurring-subscription plans from one-time "top-up" packs.
-- Existing rows default to true so they stay subscription-style.
ALTER TABLE "Plan"
  ADD COLUMN "isRecurring" BOOLEAN NOT NULL DEFAULT true;
