-- Creatives are told when a withdrawal they requested is approved, rejected
-- or paid (lib/withdrawal-notifications.ts). Adds one enum value; no data
-- changes. Safe on Postgres 12+ inside Prisma's migration transaction since
-- nothing in this migration uses the new value.
ALTER TYPE "NotificationType" ADD VALUE 'WITHDRAWAL_UPDATED';
