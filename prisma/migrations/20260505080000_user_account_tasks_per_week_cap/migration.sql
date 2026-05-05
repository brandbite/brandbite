-- AlterTable: PR10 — capacity cap on UserAccount. Mirrored from
-- TalentApplication.approvedTasksPerWeekCap during the onboarding
-- orchestrator (lib/talent-onboarding.ts). Nullable so every existing
-- UserAccount stays valid without backfill — null means "no cap", which
-- matches today's auto-assign behavior. PR3 (#TBD) reads this in
-- lib/tickets/create-ticket.ts to skip creatives at-or-above their cap.
ALTER TABLE "UserAccount"
  ADD COLUMN "tasksPerWeekCap" INTEGER;
