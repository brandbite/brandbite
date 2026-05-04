-- AlterEnum: add the two intermediate booking statuses. The flow is now:
--   SUBMITTED → AWAITING_CANDIDATE_CHOICE → ACCEPTED       (candidate picked one)
--             ↓                            ↗
--             AWAITING_CANDIDATE_CHOICE → CANDIDATE_PROPOSED_TIME → ACCEPTED
--                                                              (admin confirmed proposal)
ALTER TYPE "TalentApplicationStatus" ADD VALUE 'AWAITING_CANDIDATE_CHOICE';
ALTER TYPE "TalentApplicationStatus" ADD VALUE 'CANDIDATE_PROPOSED_TIME';

-- AlterTable: 4 new nullable columns for the tokenized self-service booking
-- flow. All nullable so PR2-era ACCEPTED / DECLINED rows continue to be
-- valid without backfill.
ALTER TABLE "TalentApplication"
  ADD COLUMN "proposedSlotsJson"     JSONB,
  ADD COLUMN "bookingToken"          TEXT,
  ADD COLUMN "bookingTokenExpiresAt" TIMESTAMP(3),
  ADD COLUMN "customMessage"         TEXT,
  ADD COLUMN "candidateProposedAt"   TIMESTAMP(3);

-- CreateIndex: bookingToken is the lookup key for the public
-- /talent/schedule/[token] page. Also enforce uniqueness so a generation
-- collision (~zero probability with 32 bytes of randomness) would surface
-- as a P2002 instead of silently linking to the wrong application.
CREATE UNIQUE INDEX "TalentApplication_bookingToken_key"
  ON "TalentApplication"("bookingToken");
