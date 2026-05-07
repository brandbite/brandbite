-- New enums for the Feedback model.
CREATE TYPE "FeedbackType" AS ENUM ('BUG', 'FEATURE', 'PRAISE', 'QUESTION');
CREATE TYPE "FeedbackStatus" AS ENUM ('NEW', 'TRIAGED', 'PLANNED', 'DONE', 'WONT_DO');

-- Feedback table — bug / feature / praise / question entries submitted by
-- signed-in users via the floating widget. Reviewable at /admin/feedback.
-- submittedById carries a real FK to UserAccount; submittedByEmail and
-- submittedByRole are snapshotted so the row stays interpretable after a
-- USER_HARD_DELETE anonymizes the account.
CREATE TABLE "Feedback" (
  "id"               TEXT             NOT NULL,
  "type"             "FeedbackType"   NOT NULL,
  "message"          TEXT             NOT NULL,
  "subject"          TEXT,
  "pageUrl"          TEXT,
  "userAgent"        TEXT,
  "viewport"         TEXT,
  "submittedById"    TEXT             NOT NULL,
  "submittedByEmail" TEXT             NOT NULL,
  "submittedByRole"  "UserRole"       NOT NULL,
  "status"           "FeedbackStatus" NOT NULL DEFAULT 'NEW',
  "adminNotes"       TEXT,
  "createdAt"        TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3)     NOT NULL,

  CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- Triage list filters by status + recency.
CREATE INDEX "Feedback_status_createdAt_idx" ON "Feedback"("status", "createdAt" DESC);
-- Per-user lookup if/when we add a "my feedback history" surface.
CREATE INDEX "Feedback_submittedById_idx" ON "Feedback"("submittedById");

ALTER TABLE "Feedback"
  ADD CONSTRAINT "Feedback_submittedById_fkey"
  FOREIGN KEY ("submittedById") REFERENCES "UserAccount"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;
