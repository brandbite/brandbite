// -----------------------------------------------------------------------------
// @file: lib/tickets/auto-timer.ts
// @purpose: Keep the creative's timer in step with the request status, so
//           logged time doesn't depend on remembering to press Start:
//           - the creative moves a request into In progress (Start work, or
//             pulling a version back) -> their timer starts on it;
//           - a request leaves In progress (sent for review, approved, moved
//             by an admin) -> any timer running on it stops.
//           A customer asking for changes does NOT start the timer: the
//           creative may not be at their desk. They start it when they begin.
//           Best effort: a timer problem never blocks the status change.
// -----------------------------------------------------------------------------

import { TicketStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { startTicketTimer, type TimeEntryDto } from "@/lib/tickets/time-tracking";

export type AutoTimerResult = {
  started: boolean;
  /** A timer that was running on another request and got stopped. */
  stoppedOtherTicketId: string | null;
};

/** The creative's own move into In progress starts their timer on this request. */
export async function autoStartTimer(
  ticketId: string,
  creativeId: string,
): Promise<AutoTimerResult> {
  try {
    const running = await prisma.ticketTimeEntry.findFirst({
      where: { creativeId, endedAt: null },
      select: { ticketId: true },
    });
    if (running?.ticketId === ticketId) return { started: false, stoppedOtherTicketId: null };
    const { autoStopped } = await startTicketTimer({ ticketId, creativeId });
    return {
      started: true,
      stoppedOtherTicketId: (autoStopped as TimeEntryDto | null)?.ticketId ?? null,
    };
  } catch (error) {
    console.error("[auto-timer] start failed", error);
    return { started: false, stoppedOtherTicketId: null };
  }
}

/** Stop whatever timer is running on this request. Returns how many stopped. */
export async function autoStopTimersOnTicket(ticketId: string): Promise<number> {
  try {
    const running = await prisma.ticketTimeEntry.findMany({
      where: { ticketId, endedAt: null },
      select: { id: true, startedAt: true },
    });
    const now = new Date();
    for (const entry of running) {
      await prisma.ticketTimeEntry.update({
        where: { id: entry.id },
        data: {
          endedAt: now,
          durationSeconds: Math.max(
            0,
            Math.floor((now.getTime() - entry.startedAt.getTime()) / 1000),
          ),
        },
      });
    }
    return running.length;
  } catch (error) {
    console.error("[auto-timer] stop failed", error);
    return 0;
  }
}

/**
 * One call for every status change: stops the timer when the request leaves
 * In progress, and starts it when the assigned creative themselves moved it in.
 */
export async function syncTimerWithStatus(args: {
  ticketId: string;
  previousStatus: TicketStatus;
  nextStatus: TicketStatus;
  /** Set when the creative made the move; customers and admins never start it. */
  creativeId?: string | null;
  startForCreative?: boolean;
}): Promise<AutoTimerResult> {
  const none = { started: false, stoppedOtherTicketId: null };
  if (args.previousStatus === args.nextStatus) return none;
  if (args.nextStatus !== TicketStatus.IN_PROGRESS) {
    await autoStopTimersOnTicket(args.ticketId);
    return none;
  }
  if (args.startForCreative && args.creativeId) {
    return autoStartTimer(args.ticketId, args.creativeId);
  }
  return none;
}
