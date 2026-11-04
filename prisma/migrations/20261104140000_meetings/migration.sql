-- Public 30-minute meeting bookings. New table and enum only.
CREATE TYPE "MeetingStatus" AS ENUM ('CONFIRMED', 'CANCELED');

CREATE TABLE "Meeting" (
    "id"              TEXT            NOT NULL,
    "name"            TEXT            NOT NULL,
    "email"           TEXT            NOT NULL,
    "company"         TEXT,
    "note"            TEXT,
    "timezone"        TEXT,
    "startsAt"        TIMESTAMP(3)    NOT NULL,
    "endsAt"          TIMESTAMP(3)    NOT NULL,
    "status"          "MeetingStatus" NOT NULL DEFAULT 'CONFIRMED',
    "activeSlot"      TIMESTAMP(3),
    "manageTokenHash" TEXT            NOT NULL,
    "googleEventId"   TEXT,
    "videoLink"       TEXT,
    "ipAddress"       TEXT,
    "createdAt"       TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3)    NOT NULL,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Meeting_activeSlot_key" ON "Meeting"("activeSlot");
CREATE UNIQUE INDEX "Meeting_manageTokenHash_key" ON "Meeting"("manageTokenHash");
CREATE INDEX "Meeting_startsAt_idx" ON "Meeting"("startsAt");
