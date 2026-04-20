-- GDPR soft-delete timestamp on UserAccount. Set when a user triggers
-- account deletion; the row stays so financial ledger entries + tickets
-- remain linkable for audit/tax compliance, but the identity is anonymized.
ALTER TABLE "UserAccount" ADD COLUMN "deletedAt" TIMESTAMP(3);
