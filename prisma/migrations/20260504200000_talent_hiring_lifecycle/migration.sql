-- AlterEnum: add post-interview lifecycle statuses. Postgres requires
-- ALTER TYPE … ADD VALUE outside a transaction; Prisma migrate runs each
-- ALTER as its own statement.
ALTER TYPE "TalentApplicationStatus" ADD VALUE 'INTERVIEW_HELD';
ALTER TYPE "TalentApplicationStatus" ADD VALUE 'HIRED';
ALTER TYPE "TalentApplicationStatus" ADD VALUE 'ONBOARDED';
ALTER TYPE "TalentApplicationStatus" ADD VALUE 'REJECTED_AFTER_INTERVIEW';

-- AlterEnum: AdminActionType audit-log values for the new admin actions.
-- _ONBOARDED is reserved for the next PR's UserAccount auto-create handler;
-- declared now so the enum doesn't need a second migration.
ALTER TYPE "AdminActionType" ADD VALUE 'TALENT_INTERVIEW_HELD';
ALTER TYPE "AdminActionType" ADD VALUE 'TALENT_HIRED';
ALTER TYPE "AdminActionType" ADD VALUE 'TALENT_REJECTED_AFTER_INTERVIEW';
ALTER TYPE "AdminActionType" ADD VALUE 'TALENT_ONBOARDED';

-- AlterTable: PR9 onboarding-capture columns. All nullable so existing
-- TalentApplication rows that never reach this lifecycle stay valid
-- without backfill. The hiredUserAccountId FK is set by the next PR's
-- onboarding orchestrator; we declare it here so PR1 can land first.
ALTER TABLE "TalentApplication"
  ADD COLUMN "workingHours"            TEXT,
  ADD COLUMN "approvedCategoryIds"     JSONB,
  ADD COLUMN "approvedTasksPerWeekCap" INTEGER,
  ADD COLUMN "hiredAt"                 TIMESTAMP(3),
  ADD COLUMN "hiredByUserId"           TEXT,
  ADD COLUMN "hiredByUserEmail"        TEXT,
  ADD COLUMN "hireNotes"               TEXT,
  ADD COLUMN "hiredUserAccountId"      TEXT;

-- CreateIndex: bidirectional unique on the optional FK so the lifecycle
-- is terminal — a single UserAccount can only be hired from at most one
-- TalentApplication. Sparse btree (nulls excluded), so the unconstrained
-- pre-hire rows don't pay a write cost.
CREATE UNIQUE INDEX "TalentApplication_hiredUserAccountId_key"
  ON "TalentApplication"("hiredUserAccountId");

-- CreateIndex: admin filter "recently hired" sorts on hiredAt DESC.
CREATE INDEX "TalentApplication_hiredAt_idx"
  ON "TalentApplication"("hiredAt" DESC);

-- AddForeignKey: TalentApplication.hiredUserAccountId → UserAccount.id.
-- ON DELETE SET NULL because a hard-deleted UserAccount shouldn't
-- delete the application audit row — we want to retain "this candidate
-- was once hired" history even if the account is later wiped.
ALTER TABLE "TalentApplication"
  ADD CONSTRAINT "TalentApplication_hiredUserAccountId_fkey"
  FOREIGN KEY ("hiredUserAccountId") REFERENCES "UserAccount"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
