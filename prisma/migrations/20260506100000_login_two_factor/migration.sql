-- AlterTable: enable BetterAuth's twoFactor plugin. Adds the boolean
-- flag on AuthUser ("user" SQL table) and creates the secret/backup-code
-- store. Both additive — every existing AuthUser starts with
-- twoFactorEnabled=false (the schema default), preserving the
-- existing email+password sign-in path until each user opts in from
-- their /profile page.
ALTER TABLE "user"
  ADD COLUMN "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;

-- New table: one row per enrolled user, contains the TOTP secret and
-- the comma-separated backup codes BetterAuth manages. CASCADE on the
-- user FK so a hard-delete of the auth row removes the 2FA record
-- alongside it; that mirrors what lib/account-deletion.ts already
-- expects to happen for AuthSession and AuthAccount.
CREATE TABLE "twoFactor" (
  "id" TEXT NOT NULL,
  "secret" TEXT NOT NULL,
  "backupCodes" TEXT NOT NULL,
  "userId" TEXT NOT NULL,

  CONSTRAINT "twoFactor_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "twoFactor_userId_idx" ON "twoFactor"("userId");
CREATE INDEX "twoFactor_secret_idx" ON "twoFactor"("secret");

ALTER TABLE "twoFactor"
  ADD CONSTRAINT "twoFactor_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
