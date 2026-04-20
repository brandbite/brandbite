-- D7: per-ticket time tracking owned by the assigned creative. Stopped
-- entries carry a denormalised durationSeconds so admin analytics can sum
-- with a single SQL aggregate. A creative can have at most one "running"
-- (endedAt IS NULL) entry at a time; the app enforces this on start.

CREATE TABLE "TicketTimeEntry" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "creativeId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketTimeEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TicketTimeEntry_ticketId_startedAt_idx" ON "TicketTimeEntry"("ticketId", "startedAt");
CREATE INDEX "TicketTimeEntry_creativeId_endedAt_idx" ON "TicketTimeEntry"("creativeId", "endedAt");

ALTER TABLE "TicketTimeEntry"
    ADD CONSTRAINT "TicketTimeEntry_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TicketTimeEntry"
    ADD CONSTRAINT "TicketTimeEntry_creativeId_fkey"
    FOREIGN KEY ("creativeId") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
