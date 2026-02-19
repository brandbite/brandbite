// -----------------------------------------------------------------------------
// @file: app/api/designer/tickets/route.ts
// @purpose: Designer API for listing and updating assigned tickets (status, revisions, notes; no DONE)
// @version: v1.6.1
// @status: active
// @lastUpdate: 2025-12-25
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { TicketStatus, TicketPriority } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";

type TicketStatusString = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";

type DesignerTicket = {
  id: string;
  title: string;
  description: string | null;
  status: TicketStatusString;
  priority: TicketPriority;
  dueDate: string | null;
  companyTicketNumber: number | null;
  createdAt: string;
  updatedAt: string;
  company: {
    id: string;
    name: string;
    slug: string;
  } | null;
  project: {
    id: string;
    name: string;
    code: string | null;
  } | null;
  jobType: {
    id: string;
    name: string;
    tokenCost: number;
    designerPayoutTokens: number;
  } | null;
  revisionCount: number;
  latestRevisionHasFeedback: boolean;
  latestRevisionFeedbackSnippet: string | null;
};

type DesignerTicketsResponse = {
  stats: {
    byStatus: Record<TicketStatusString, number>;
    total: number;
    openTotal: number;
    byPriority: Record<TicketPriority, number>;
    loadScore: number;
  };
  tickets: DesignerTicket[];
};

type PatchPayload = {
  id?: string;
  status?: string;
  designerMessage?: string | null;
};

function isValidTicketStatus(value: unknown): value is TicketStatus {
  if (typeof value !== "string") return false;
  return (
    value === "TODO" ||
    value === "IN_PROGRESS" ||
    value === "IN_REVIEW" ||
    value === "DONE"
  );
}

function toTicketStatusString(status: TicketStatus): TicketStatusString {
  return status as TicketStatusString;
}

// -----------------------------------------------------------------------------
// GET: list designer tickets
// -----------------------------------------------------------------------------

export async function GET() {
  try {
    const user = await getCurrentUserOrThrow();

    if (user.role !== "DESIGNER") {
      return NextResponse.json(
        { error: "Only designers can access this endpoint." },
        { status: 403 },
      );
    }

    const tickets = await prisma.ticket.findMany({
      where: {
        designerId: user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        dueDate: true,
        companyTicketNumber: true,
        createdAt: true,
        updatedAt: true,
        company: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        jobType: {
          select: {
            id: true,
            name: true,
            tokenCost: true,
            designerPayoutTokens: true,
          },
        },
        revisionCount: true,
        revisions: {
          orderBy: {
            version: "desc",
          },
          take: 1,
          select: {
            feedbackMessage: true,
            feedbackAt: true,
            feedbackByCustomerId: true,
          },
        },
      },
    });

    const byStatus: Record<TicketStatusString, number> = {
      TODO: 0,
      IN_PROGRESS: 0,
      IN_REVIEW: 0,
      DONE: 0,
    };

    const byPriority: Record<TicketPriority, number> = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      URGENT: 0,
    };

    const priorityWeights: Record<TicketPriority, number> = {
      LOW: 1,
      MEDIUM: 2,
      HIGH: 3,
      URGENT: 4,
    };

    let openTotal = 0;
    let loadScore = 0;

    for (const t of tickets) {
      const statusKey = toTicketStatusString(t.status);

      byStatus[statusKey] = (byStatus[statusKey] ?? 0) + 1;
      byPriority[t.priority] = (byPriority[t.priority] ?? 0) + 1;

      if (t.status !== TicketStatus.DONE) {
        openTotal += 1;

        const weight = priorityWeights[t.priority];
        const tokenCost = t.jobType?.tokenCost ?? 1;
        loadScore += weight * tokenCost;
      }
    }

    const response: DesignerTicketsResponse = {
      stats: {
        byStatus,
        total: tickets.length,
        openTotal,
        byPriority,
        loadScore,
      },
      tickets: tickets.map((t) => {
        const latestRevision = t.revisions?.[0];

        const latestRevisionHasFeedback = !!(
          latestRevision &&
          latestRevision.feedbackMessage &&
          latestRevision.feedbackByCustomerId
        );

        let latestRevisionFeedbackSnippet: string | null = null;
        if (latestRevision && latestRevision.feedbackMessage) {
          const full = latestRevision.feedbackMessage;
          latestRevisionFeedbackSnippet =
            full.length > 180 ? full.slice(0, 177) + "..." : full;
        }

        return {
          id: t.id,
          title: t.title,
          description: t.description,
          status: toTicketStatusString(t.status),
          priority: t.priority,
          dueDate: t.dueDate ? t.dueDate.toISOString() : null,
          companyTicketNumber: t.companyTicketNumber ?? null,
          createdAt: t.createdAt.toISOString(),
          updatedAt: t.updatedAt.toISOString(),
          company: t.company
            ? {
                id: t.company.id,
                name: t.company.name,
                slug: t.company.slug,
              }
            : null,
          project: t.project
            ? {
                id: t.project.id,
                name: t.project.name,
                code: t.project.code,
              }
            : null,
          jobType: t.jobType
            ? {
                id: t.jobType.id,
                name: t.jobType.name,
                tokenCost: t.jobType.tokenCost,
                designerPayoutTokens: t.jobType.designerPayoutTokens,
              }
            : null,
          revisionCount: t.revisionCount ?? 0,
          latestRevisionHasFeedback,
          latestRevisionFeedbackSnippet,
        };
      }),
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error: any) {
    if ((error as any)?.code === "UNAUTHENTICATED") {
      return NextResponse.json(
        { error: "Unauthenticated" },
        { status: 401 },
      );
    }

    console.error("[designer.tickets] GET error", error);
    return NextResponse.json(
      { error: "Failed to load designer tickets" },
      { status: 500 },
    );
  }
}

// -----------------------------------------------------------------------------
// PATCH: update ticket status (designers cannot mark DONE, creates revisions)
//
// Plan bazlı concurrency kuralı:
// - Plan.maxConcurrentInProgressTickets değeri,
//   aynı company için eşzamanlı IN_PROGRESS ticket sayısının üst sınırıdır.
// - Sadece IN_PROGRESS'e geçişte kontrol edilir.
// - TODO / IN_REVIEW geçişleri bu limitten etkilenmez.
//
// Revision kuralı:
// - Designer tarafında IN_PROGRESS -> IN_REVIEW geçişinde:
//   - Ticket.revisionCount +1
//   - Aynı transaction içinde yeni bir TicketRevision kaydı oluşturulur.
//
// Designer note kuralı:
// - Admin tarafından designer için designerRevisionNotesEnabled = true ise,
//   IN_PROGRESS -> IN_REVIEW geçişinde optional designerMessage alır ve
//   TicketRevision.designerMessage alanına yazar.
// - Flag false ise, gönderilen designerMessage görmezden gelinir.
// -----------------------------------------------------------------------------

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (user.role !== "DESIGNER") {
      return NextResponse.json(
        { error: "Only designers can update these tickets." },
        { status: 403 },
      );
    }

    const body = (await req.json()) as PatchPayload;
    const id = body.id;
    const requestedStatus = body.status;

    if (!id || !requestedStatus) {
      return NextResponse.json(
        { error: "Both id and status are required." },
        { status: 400 },
      );
    }

    if (!isValidTicketStatus(requestedStatus)) {
      return NextResponse.json(
        { error: "Invalid ticket status." },
        { status: 400 },
      );
    }

    const nextStatus = requestedStatus as TicketStatus;

    if (nextStatus === TicketStatus.DONE) {
      return NextResponse.json(
        {
          error:
            "Designers cannot mark tickets as DONE. Please ask the client to close the ticket.",
        },
        { status: 403 },
      );
    }

    // Designer flag'i DB'den oku
    const designer = await prisma.userAccount.findUnique({
      where: { id: user.id },
      select: { id: true, designerRevisionNotesEnabled: true },
    });

    if (!designer) {
      return NextResponse.json(
        { error: "Designer not found." },
        { status: 401 },
      );
    }

    const ticket = await prisma.ticket.findFirst({
      where: {
        id,
        designerId: user.id,
      },
      select: {
        id: true,
        title: true,
        status: true,
        companyId: true,
        createdById: true,
      },
    });

    if (!ticket) {
      return NextResponse.json(
        { error: "Ticket not found." },
        { status: 404 },
      );
    }

    if (ticket.status === TicketStatus.DONE) {
      return NextResponse.json(
        {
          error:
            "This ticket is already marked as DONE and cannot be changed by a designer.",
        },
        { status: 403 },
      );
    }

    // -------------------------------------------------------------------------
    // Plan-based concurrency check for IN_PROGRESS
    // -------------------------------------------------------------------------
    if (
      nextStatus === TicketStatus.IN_PROGRESS &&
      ticket.status !== TicketStatus.IN_PROGRESS
    ) {
      const companyWithPlan = await prisma.company.findUnique({
        where: { id: ticket.companyId },
        select: {
          plan: true,
        },
      });

      const planData = companyWithPlan?.plan as
        | {
            name?: string | null;
            maxConcurrentInProgressTickets?: number | null;
          }
        | null
        | undefined;

      const maxConcurrent =
        typeof planData?.maxConcurrentInProgressTickets === "number"
          ? planData.maxConcurrentInProgressTickets
          : 1;

      const currentInProgressCount = await prisma.ticket.count({
        where: {
          companyId: ticket.companyId,
          status: TicketStatus.IN_PROGRESS,
        },
      });

      if (currentInProgressCount >= maxConcurrent) {
        const planLabel =
          typeof planData?.name === "string"
            ? planData.name
            : "current plan";

        return NextResponse.json(
          {
            error:
              "This company has reached its limit for active tickets in progress.",
            details: {
              plan: planLabel,
              maxConcurrentInProgress: maxConcurrent,
              currentInProgress: currentInProgressCount,
            },
          },
          { status: 400 },
        );
      }
    }

    const isInProgressToInReview =
      ticket.status === TicketStatus.IN_PROGRESS &&
      nextStatus === TicketStatus.IN_REVIEW;

    // Designer mesajını hazırlama
    const rawDesignerMessage =
      typeof body.designerMessage === "string"
        ? body.designerMessage.trim()
        : "";
    const designerMessageToStore =
      designer.designerRevisionNotesEnabled && rawDesignerMessage
        ? rawDesignerMessage
        : null;

    let updated: { id: string; status: TicketStatus; updatedAt: Date; revisionId?: string };

    if (isInProgressToInReview) {
      updated = await prisma.$transaction(async (tx) => {
        const updatedTicket = await tx.ticket.update({
          where: { id: ticket.id },
          data: {
            status: nextStatus,
            revisionCount: {
              increment: 1,
            },
          },
          select: {
            id: true,
            status: true,
            updatedAt: true,
            revisionCount: true,
          },
        });

        const revision = await tx.ticketRevision.create({
          data: {
            ticketId: updatedTicket.id,
            version: updatedTicket.revisionCount,
            submittedByDesignerId: user.id,
            designerMessage: designerMessageToStore,
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
      const result = await prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          status: nextStatus,
        },
        select: {
          id: true,
          status: true,
          updatedAt: true,
        },
      });

      updated = result;
    }

    // Fire notifications (fire-and-forget, won't block the response)
    if (isInProgressToInReview) {
      createNotification({
        userId: ticket.createdById,
        type: "REVISION_SUBMITTED",
        title: "New revision submitted",
        message: `Your designer submitted a new version for "${ticket.title}"`,
        ticketId: ticket.id,
        actorId: user.id,
      });
    } else {
      createNotification({
        userId: ticket.createdById,
        type: "TICKET_STATUS_CHANGED",
        title: "Ticket status updated",
        message: `"${ticket.title}" was moved to ${toTicketStatusString(updated.status).replace("_", " ").toLowerCase()}`,
        ticketId: ticket.id,
        actorId: user.id,
      });
    }

    return NextResponse.json(
      {
        ticketId: updated.id,
        status: toTicketStatusString(updated.status),
        updatedAt: updated.updatedAt.toISOString(),
        ...(updated.revisionId ? { revisionId: updated.revisionId } : {}),
      },
      { status: 200 },
    );
  } catch (error: any) {
    if ((error as any)?.code === "UNAUTHENTICATED") {
      return NextResponse.json(
        { error: "Unauthenticated" },
        { status: 401 },
      );
    }

    console.error("[designer.tickets] PATCH error", error);
    return NextResponse.json(
      { error: "Failed to update ticket" },
      { status: 500 },
    );
  }
}
