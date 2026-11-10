-- Moving brandbite-stored (R2) source files into a Google Drive or Dropbox
-- the customer connects later.
ALTER TABLE "TicketSourceFile" ADD COLUMN "copyAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TicketSourceFile" ADD COLUMN "copyError" TEXT;
