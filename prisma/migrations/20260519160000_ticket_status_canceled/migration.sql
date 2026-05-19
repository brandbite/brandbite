-- Add CANCELED to TicketStatus enum
-- ------------------------------------------------------------
-- New value lets a customer OWNER/PM soft-cancel a TODO ticket
-- and trigger a full token refund. The row stays in the DB so
-- the REFUND ledger entry + audit trail remain inspectable.
-- Additive only — zero risk to existing rows.

ALTER TYPE "TicketStatus" ADD VALUE 'CANCELED';
