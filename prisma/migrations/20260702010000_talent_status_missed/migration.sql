-- TalentApplicationStatus: add MISSED (interview booked, candidate no-show).
-- Placed after ACCEPTED / before INTERVIEW_HELD to read in lifecycle order.
-- Additive enum value, no backfill — zero-risk. (ADD VALUE cannot run inside a
-- transaction that then USES the value; this migration only adds it.)
ALTER TYPE "TalentApplicationStatus" ADD VALUE 'MISSED' BEFORE 'INTERVIEW_HELD';
