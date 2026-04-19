-- Google Calendar OAuth connection on the ConsultationSettings singleton.
ALTER TABLE "ConsultationSettings"
  ADD COLUMN "googleAccountEmail"   TEXT,
  ADD COLUMN "googleCalendarId"     TEXT DEFAULT 'primary',
  ADD COLUMN "googleAccessToken"    TEXT,
  ADD COLUMN "googleRefreshToken"   TEXT,
  ADD COLUMN "googleTokenExpiresAt" TIMESTAMP(3),
  ADD COLUMN "googleConnectedAt"    TIMESTAMP(3);

-- Google event id on Consultation rows that were auto-scheduled.
ALTER TABLE "Consultation"
  ADD COLUMN "googleEventId" TEXT;
