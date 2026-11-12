// -----------------------------------------------------------------------------
// @file: lib/tickets/transition-status.ts
// @purpose: Domain service — creative-side ticket status transition
//           (IN_PROGRESS ↔ IN_REVIEW ↔ TODO, excluding DONE). Enforces
//           ownership, plan concurrency limits, and creates a new
//           TicketRevision row on IN_PROGRESS → IN_REVIEW. Pulling that
//           version back within a minute withdraws it (review-undo.ts).
//
// Extracted from app/api/creative/tickets/route.ts to keep the route a
// thin I/O shell. All structured failures are represented as a tagged
// union so the route can map them to HTTP responses without a second
// copy of the business rules.
// -----------------------------------------------------------------------------

import { TicketStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { creativeTransitionError } from "@/lib/tickets/creative-transitions";
import { canUndoReview } from "@/lib/tickets/review-undo";
import { recordTicketEvent } from "@/lib/tickets/ticket-events";

export type TransitionStatusInput = {
  creativeUserId: string;
  ticketId: string;
  nextStatus: TicketStatus;
  /** Optional feedback-note body. Only persisted when the creative has
   *  creativeRevisionNotesEnabled AND the transition produces a revision. */
  creativeMessage?: string | null;
};

export type NotificationIntent = {
  recipientUserId: string;
  notificationType: "REVISION_SUBMITTED" | "TICKET_STATUS_CHANGED";
  title: string;
  message: string;
  ticketId: string;
  actorId: string;
};

export type TransitionStatusSuccess = {
  success: true;
  result: {
    ticketId: string;
    status: TicketStatus;
    previousStatus: TicketStatus;
    updatedAt: Date;
    revisionId?: string;
    /** A version sent under a minute ago was withdrawn (see review-undo.ts). */
    undone?: boolean;
  };
  /** Null when a just-sent version was undone: the customer was never told. */
  notify: NotificationIntent | null;
};

export type TransitionStatusFailure =
  | { success: false; code: "FORBIDDEN_DONE"; message: string }
  | { success: false; code: "CREATIVE_NOT_FOUND"; message: string }
  | { success: false; code: "NOT_FOUND"; message: string }
  | { success: false; code: "ALREADY_DONE"; message: string }
  | { success: false; code: "INVALID_TRANSITION"; message: string }
  | {
      success: false;
      code: "CONCURRENCY_LIMIT";
      message: string;
      details: {
        plan: string;
        maxConcurrentInProgress: number;
        currentInProgress: number;
      };
    };

export type TransitionStatusResult = TransitionStatusSuccess | TransitionStatusFailure;

export async function transitionCreativeTicketStatus(
  input: TransitionStatusInput,
): Promise<TransitionStatusResult> {
  const { creativeUserId, ticketId, nextStatus, creativeMessage } = input;

  // Creatives are not allowed to mark DONE — that's a customer action.
  if (nextStatus === TicketStatus.DONE) {
    return {
      success: false,
      code: "FORBIDDEN_DONE",
      message:
        "Creatives cannot mark requests as DONE. Please ask the client to close the request.",
    };
  }

  const creative = await prisma.userAccount.findUnique({
    where: { id: creativeUserId },
    select: { id: true, creativeRevisionNotesEnabled: true },
  });
  if (!creative) {
    return { success: false, code: "CREATIVE_NOT_FOUND", message: "Creative not found." };
  }

  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, creativeId: creativeUserId },
    select: {
      id: true,
      title: true,
      status: true,
      companyId: true,
      createdById: true,
    },
  });
  if (!ticket) {
    return { success: false, code: "NOT_FOUND", message: "Request not found." };
  }
  if (ticket.status === TicketStatus.DONE) {
    return {
      success: false,
      code: "ALREADY_DONE",
      message: "This request is already marked as DONE and cannot be changed by a creative.",
    };
  }

  const transitionError = creativeTransitionError(ticket.status, nextStatus);
  if (transitionError) {
    return { success: false, code: "INVALID_TRANSITION", message: transitionError };
  }

  // Plan-based concurrency gate — only relevant when transitioning INTO
  // IN_PROGRESS from a non-IN_PROGRESS state.
  if (nextStatus === TicketStatus.IN_PROGRESS && ticket.status !== TicketStatus.IN_PROGRESS) {
    const companyWithPlan = await prisma.company.findUnique({
      where: { id: ticket.companyId },
      select: { plan: true },
    });

    const planData = companyWithPlan?.plan as
      | { name?: string | null; maxConcurrentInProgressTickets?: number | null }
      | null
      | undefined;

    const maxConcurrent =
      typeof planData?.maxConcurrentInProgressTickets === "number"
        ? planData.maxConcurrentInProgressTickets
        : 1;

    const currentInProgressCount = await prisma.ticket.count({
      where: { companyId: ticket.companyId, status: TicketStatus.IN_PROGRESS },
    });

    if (currentInProgressCount >= maxConcurrent) {
      return {
        success: false,
        code: "CONCURRENCY_LIMIT",
        message: "This company has reached its limit for active requests in progress.",
        details: {
          plan: typeof planData?.name === "string" ? planData.name : "current plan",
          maxConcurrentInProgress: maxConcurrent,
          currentInProgress: currentInProgressCount,
        },
      };
    }
  }

  // Pulling back a version sent less than a minute ago is an undo: the
  // customer hasn't been told yet, so the version is withdrawn as if it was
  // never sent (not counted, files removed, no notification).
  if (ticket.status === TicketStatus.IN_REVIEW && nextStatus === TicketStatus.IN_PROGRESS) {
    const latest = await prisma.ticketRevision.findFirst({
      where: { ticketId: ticket.id },
      orderBy: { version: "desc" },
      select: { id: true, submittedAt: true, feedbackAt: true, submittedByCreativeId: true },
    });
    if (latest && latest.submittedByCreativeId === creativeUserId && canUndoReview(latest)) {
      const undone = await prisma.$transaction(async (tx) => {
        await tx.asset.updateMany({
          where: { revisionId: latest.id },
          data: { revisionId: null, deletedAt: new Date() },
        });
        await tx.ticketRevision.delete({ where: { id: latest.id } });
        return tx.ticket.update({
          where: { id: ticket.id },
          data: { status: nextStatus, revisionCount: { decrement: 1 } },
          select: { id: true, status: true, updatedAt: true },
        });
      });
      return {
        success: true,
        result: {
          ticketId: undone.id,
          status: undone.status,
          previousStatus: ticket.status,
          updatedAt: undone.updatedAt,
          undone: true,
        },
        notify: null,
      };
    }
  }

  const isInProgressToInReview =
    ticket.status === TicketStatus.IN_PROGRESS && nextStatus === TicketStatus.IN_REVIEW;

  // Only keep the note when the creative has notes enabled AND this
  // transition is the one that produces a revision. Silently dropped
  // otherwise — avoids surprising the creative with stale data.
  const rawMessage = (creativeMessage ?? "").trim();
  const creativeMessageToStore =
    creative.creativeRevisionNotesEnabled && rawMessage ? rawMessage : null;

  // Transition + (optional) revision in a single transaction so the
  // revisionCount increment and TicketRevision row stay consistent.
  let updated: {
    id: string;
    status: TicketStatus;
    updatedAt: Date;
    revisionId?: string;
  };

  if (isInProgressToInReview) {
    updated = await prisma.$transaction(async (tx) => {
      const updatedTicket = await tx.ticket.update({
        where: { id: ticket.id },
        data: { status: nextStatus, revisionCount: { increment: 1 } },
        select: { id: true, status: true, updatedAt: true, revisionCount: true },
      });

      const revision = await tx.ticketRevision.create({
        data: {
          ticketId: updatedTicket.id,
          version: updatedTicket.revisionCount,
          submittedByCreativeId: creativeUserId,
          creativeMessage: creativeMessageToStore,
        },
        select: { id: true },
      });

      return {
        id: updatedTicket.id,
        status: updatedTicket.status,
        updatedAt: updatedTicket.updatedAt,
        revisionId: revision.id,
      };
    });
  } else {
    updated = await prisma.ticket.update({
      where: { id: ticket.id },
      data: { status: nextStatus },
      select: { id: true, status: true, updatedAt: true },
    });
    // The new revision records the IN_PROGRESS → IN_REVIEW case above.
    await recordTicketEvent({
      ticketId: ticket.id,
      actorId: creativeUserId,
      type: "STATUS_CHANGED",
      metadata: { from: ticket.status, to: nextStatus },
    });
  }

  const notify: NotificationIntent = isInProgressToInReview
    ? {
        recipientUserId: ticket.createdById,
        notificationType: "REVISION_SUBMITTED",
        title: "New revision submitted",
        message: `Your creative submitted a new version for "${ticket.title}"`,
        ticketId: ticket.id,
        actorId: creativeUserId,
      }
    : {
        recipientUserId: ticket.createdById,
        notificationType: "TICKET_STATUS_CHANGED",
        title: "Request status updated",
        message: `"${ticket.title}" was moved to ${String(updated.status).replace("_", " ").toLowerCase()}`,
        ticketId: ticket.id,
        actorId: creativeUserId,
      };

  return {
    success: true,
    result: {
      ticketId: updated.id,
      status: updated.status,
      previousStatus: ticket.status,
      updatedAt: updated.updatedAt,
      revisionId: updated.revisionId,
    },
    notify,
  };
}
