-- Backfill displayOrder for every plan that doesn't have one yet, using
-- priceCents ascending as the natural default. The previous migration
-- (20260430120000_plan_display_copy) only set displayOrder for plans
-- named Starter / Brand / Full, leaving any other plan name (Basic, Pro,
-- enterprise, etc.) with displayOrder = NULL. With Prisma's
-- `nulls: "last"` ordering on /api/plans this pushed unnamed plans to
-- the end and the named one to the front — wrong direction.
--
-- This migration assigns 0..N-1 to every NULL row in priceCents-asc
-- order so the landing page renders cheapest-first by default. After
-- this, admins can override individual rows via /admin/plans without
-- worrying about partial-NULL state.
--
-- Idempotent: only touches rows where displayOrder IS NULL.
UPDATE "Plan"
SET "displayOrder" = sub.row_number - 1
FROM (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY "priceCents" ASC, "name" ASC) AS row_number
  FROM "Plan"
  WHERE "displayOrder" IS NULL
) AS sub
WHERE "Plan".id = sub.id
  AND "Plan"."displayOrder" IS NULL;
