-- ConsultationSettings: track a broken (revoked / expired) Google OAuth
-- connection separately from "never connected". Both nullable — no backfill.
ALTER TABLE "ConsultationSettings" ADD COLUMN "googleConnectionBrokenAt" TIMESTAMP(3);
ALTER TABLE "ConsultationSettings" ADD COLUMN "googleConnectionLastError" TEXT;
