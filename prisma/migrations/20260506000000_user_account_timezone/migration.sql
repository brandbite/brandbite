-- AlterTable: add a nullable IANA timezone string per user. Hydrated
-- from the browser's resolved zone the first time a user saves their
-- profile; user-overridable from the new /profile page. Null = fall
-- back to UTC display in any user-facing date formatting. Additive
-- and nullable, so every existing row stays valid without backfill.
ALTER TABLE "UserAccount"
  ADD COLUMN "timezone" TEXT;
