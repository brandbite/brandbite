// -----------------------------------------------------------------------------
// @file: lib/tickets/assignment-notification.ts
// @purpose: Tell a creative a request was assigned to them, whichever way it
//           happened: auto-assign on create, an admin picking them on the
//           request, or a bulk reassign. Fire-and-forget like every other
//           notification; respects the creative's in-app and email choices.
// -----------------------------------------------------------------------------

import { createNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { buildTicketCode } from "@/lib/ticket-code";

export async function notifyCreativeAssigned(args: {
  ticketId: string;
  creativeId: string;
  actorId?: string;
}): Promise<void> {
  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id: args.ticketId },
      select: {
        id: true,
        title: true,
        companyTicketNumber: true,
        project: { select: { code: true } },
      },
    });
    if (!ticket) return;
    const code = buildTicketCode({
      projectCode: ticket.project?.code,
      companyTicketNumber: ticket.companyTicketNumber,
      ticketId: ticket.id,
    });
    await createNotification({
      userId: args.creativeId,
      type: "TICKET_ASSIGNED",
      title: "New request assigned",
      message: `${code} "${ticket.title}" was assigned to you`,
      ticketId: ticket.id,
      actorId: args.actorId,
    });
  } catch (error) {
    console.error("[notifyCreativeAssigned] failed", error);
  }
}
