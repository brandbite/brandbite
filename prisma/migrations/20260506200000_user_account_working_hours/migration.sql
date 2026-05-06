-- AlterTable: add free-text working hours per user. Populated at hire
-- time on the talent application; mirrored here so the creative and
-- admins can edit it later without touching the (audit-only) talent
-- application row.
ALTER TABLE "UserAccount"
  ADD COLUMN "workingHours" TEXT;

-- Backfill: copy workingHours from TalentApplication for every creative
-- that's been onboarded. talentApplication.hiredUserAccountId points at
-- the corresponding UserAccount. Skips any application without a hire
-- link or a stored value (which means the field was empty at hire time
-- and the creative will fill it in from /profile).
UPDATE "UserAccount" u
   SET "workingHours" = ta."workingHours"
  FROM "TalentApplication" ta
 WHERE ta."hiredUserAccountId" = u.id
   AND ta."workingHours" IS NOT NULL;
