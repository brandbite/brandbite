// -----------------------------------------------------------------------------
// @file: lib/ticket-code.ts
// @purpose: Build human-readable ticket display codes (e.g. WEB-101)
// -----------------------------------------------------------------------------

/**
 * Build the display code for a ticket.
 *
 * Format: WEB-101 (project code + ticket number)
 * Fallback: #101 (if no project code)
 * Fallback: ticket id (if no ticket number)
 */
export function buildTicketCode(params: {
  projectCode?: string | null;
  companyTicketNumber?: number | null;
  ticketId: string;
}): string {
  const { projectCode, companyTicketNumber, ticketId } = params;

  if (projectCode && companyTicketNumber != null) {
    return `${projectCode}-${companyTicketNumber}`;
  }

  if (companyTicketNumber != null) {
    return `#${companyTicketNumber}`;
  }

  return ticketId;
}
