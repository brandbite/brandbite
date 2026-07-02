-- AdminActionType: add TALENT_INTERVIEW_MISSED for the no-show audit event.
-- Additive enum value, no backfill — zero-risk.
ALTER TYPE "AdminActionType" ADD VALUE 'TALENT_INTERVIEW_MISSED' AFTER 'TALENT_INTERVIEW_HELD';
