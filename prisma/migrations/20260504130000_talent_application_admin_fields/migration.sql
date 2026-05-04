-- AlterEnum: add the two SITE_OWNER-only audit actions for the talent
-- application accept / decline flows. Postgres requires ALTER TYPE … ADD
-- VALUE outside a transaction; Prisma migrate runs each ALTER as its own
-- statement, so two separate statements satisfy that rule.
ALTER TYPE "AdminActionType" ADD VALUE 'TALENT_APPLICATION_ACCEPTED';
ALTER TYPE "AdminActionType" ADD VALUE 'TALENT_APPLICATION_DECLINED';

-- AlterTable: capture the reviewer + interview booking metadata on each
-- TalentApplication. All columns are nullable because rows submitted
-- before this migration (PR1 backfill) have no reviewer + no interview.
-- The accept flow writes googleEventId + meetLink + interviewAt as one
-- transaction together with the status flip; partial state would be a
-- regression. The decline flow writes reviewedBy + declineReason only.
ALTER TABLE "TalentApplication"
  ADD COLUMN "reviewedAt"          TIMESTAMP(3),
  ADD COLUMN "reviewedByUserId"    TEXT,
  ADD COLUMN "reviewedByUserEmail" TEXT,
  ADD COLUMN "googleEventId"       TEXT,
  ADD COLUMN "meetLink"            TEXT,
  ADD COLUMN "interviewAt"         TIMESTAMP(3),
  ADD COLUMN "declineReason"       TEXT;

-- CreateIndex: PR2 admin filter "show upcoming interviews" (sorted by
-- interviewAt). Cheap because the column is sparse — only ACCEPTED rows
-- carry a value, and the index excludes nulls implicitly via btree.
CREATE INDEX "TalentApplication_interviewAt_idx" ON "TalentApplication"("interviewAt");
