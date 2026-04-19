// -----------------------------------------------------------------------------
// @file: lib/schemas/bulk-tickets.schemas.ts
// @purpose: Zod schemas for POST /api/admin/tickets/bulk — multi-ticket
//           admin operations (reassign creative, change status, change
//           priority). A discriminated union on `op` keeps the payload
//           tight at the edge and the handler branch-dense.
// -----------------------------------------------------------------------------

import { z } from "zod";
import { TicketPriority, TicketStatus } from "@prisma/client";

const ticketIdsSchema = z
  .array(z.string().min(1))
  .min(1, "Select at least one ticket.")
  .max(100, "Bulk ops are capped at 100 tickets per request.");

export const bulkReassignSchema = z.object({
  op: z.literal("reassign"),
  ticketIds: ticketIdsSchema,
  /** null explicitly unassigns; a string must be a valid user id (creative). */
  creativeId: z.string().min(1).nullable(),
});

export const bulkStatusSchema = z.object({
  op: z.literal("status"),
  ticketIds: ticketIdsSchema,
  status: z.nativeEnum(TicketStatus),
});

export const bulkPrioritySchema = z.object({
  op: z.literal("priority"),
  ticketIds: ticketIdsSchema,
  priority: z.nativeEnum(TicketPriority),
});

export const bulkTicketsSchema = z.discriminatedUnion("op", [
  bulkReassignSchema,
  bulkStatusSchema,
  bulkPrioritySchema,
]);

export type BulkTicketsInput = z.infer<typeof bulkTicketsSchema>;
