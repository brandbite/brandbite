-- Audit entry for bulk ticket status changes from /admin/tickets (one row
-- per batch). Enum value only; no data changes.
ALTER TYPE "AdminActionType" ADD VALUE 'TICKET_BULK_STATUS_CHANGE';
