-- CompanyInvite: add an expiry timestamp. Set to createdAt + 7 days by the
-- create route going forward. Nullable with no backfill: existing pending
-- invites keep a NULL expiresAt and are treated as non-expiring by the accept
-- flow, so this migration cannot retroactively invalidate outstanding invites.
ALTER TABLE "CompanyInvite" ADD COLUMN "expiresAt" TIMESTAMP(3);
