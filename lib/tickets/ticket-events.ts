// -----------------------------------------------------------------------------
// @file: lib/tickets/ticket-events.ts
// @purpose: Record ticket changes no other table keeps, for the Activity tab.
//           Created, assigned, version, feedback and completion history already
//           live in their own tables. See lib/tickets/ticket-activity.ts.
// -----------------------------------------------------------------------------

import { Prisma, type TicketStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type TicketDetailField =
  | "title"
  | "description"
  | "priority"
  | "dueDate"
  | "project"
  | "jobType";

export type TicketEventInput = { ticketId: string; actorId: string | null } & (
  | { type: "STATUS_CHANGED"; metadata: { from: TicketStatus; to: TicketStatus } }
  | { type: "CREATIVE_CHANGED"; metadata: { toCreativeId: string | null } }
  | {
      type: "DETAILS_UPDATED";
      metadata: {
        fields: TicketDetailField[];
        priority?: { from: string; to: string };
      };
    }
);

/**
 * Inside a transaction, pass `tx` so the event commits with the change it
 * describes. Outside one, the change has already happened, so a failed history
 * write is logged rather than turning a successful request into an error.
 */
export async function recordTicketEvent(
  event: TicketEventInput,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const data = {
    ticketId: event.ticketId,
    actorId: event.actorId,
    type: event.type,
    metadata: event.metadata as Prisma.InputJsonValue,
  };

  if (tx) {
    await tx.ticketEvent.create({ data });
    return;
  }

  try {
    await prisma.ticketEvent.create({ data });
  } catch (error) {
    console.error("[ticket-events] failed to record event", event.type, event.ticketId, error);
  }
}
