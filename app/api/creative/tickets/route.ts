// -----------------------------------------------------------------------------
// @file: app/api/creative/tickets/route.ts
// @purpose: Creative API for listing and updating assigned tickets (status, revisions, notes; no DONE)
// @version: v1.6.1
// @status: active
// @lastUpdate: 2025-12-25
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { TicketStatus, TicketPriority } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";
import { transitionCreativeTicketStatus } from "@/lib/tickets/transition-status";

type TicketStatusString = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";

type CreativeTicket = {
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
    creativePayoutTokens: number;
  } | null;
  revisionCount: number;
  latestRevisionHasFeedback: boolean;
  latestRevisionFeedbackSnippet: string | null;
};

type CreativeTicketsResponse = {
  stats: {
    byStatus: Record<TicketStatusString, number>;
    total: number;
    openTotal: number;
    byPriority: Record<TicketPriority, number>;
    loadScore: number;
  };
  tickets: CreativeTicket[];
};

type PatchPayload = {
  id?: string;
  status?: string;
  creativeMessage?: string | null;
};

function isValidTicketStatus(value: unknown): value is TicketStatus {
  if (typeof value !== "string") return false;
  return value === "TODO" || value === "IN_PROGRESS" || value === "IN_REVIEW" || value === "DONE";
}

function toTicketStatusString(status: TicketStatus): TicketStatusString {
  return status as TicketStatusString;
}

// -----------------------------------------------------------------------------
// GET: list creative tickets
// -----------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (user.role !== "DESIGNER") {
      return NextResponse.json(
        { error: "Only creatives can access this endpoint." },
        { status: 403 },
      );
    }

    // ── Parse query params ──────────────────────────────────────────────
    const url = new URL(req.url);
    const search = url.searchParams.get("search")?.trim() || "";
    const status = url.searchParams.get("status") || "";
    const priority = url.searchParams.get("priority") || "";
    const sortBy = url.searchParams.get("sortBy") || "createdAt";
    const sortDir = url.searchParams.get("sortDir") || "desc";
    const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "50", 10), 1), 200);
    const offset = Math.max(parseInt(url.searchParams.get("offset") || "0", 10), 0);

    // ── Stats: always computed from UNFILTERED set ──────────────────────
    const allTickets = await prisma.ticket.findMany({
      where: { creativeId: user.id },
      select: {
        status: true,
        priority: true,
        jobType: { select: { tokenCost: true } },
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

    for (const t of allTickets) {
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

    // ── Build filtered where clause ─────────────────────────────────────
    const where: any = { creativeId: user.id };

    if (status && ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"].includes(status)) {
      where.status = status;
    }

    if (priority && ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(priority)) {
      where.priority = priority;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { company: { name: { contains: search, mode: "insensitive" } } },
        { project: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    // ── Build orderBy ───────────────────────────────────────────────────
    const dir = sortDir === "asc" ? "asc" : "desc";
    const validSortFields: Record<string, any> = {
      createdAt: { createdAt: dir },
      dueDate: { dueDate: dir },
      status: { status: dir },
      priority: { priority: dir },
      title: { title: dir },
    };
    const orderBy = validSortFields[sortBy] || { createdAt: "desc" };

    // ── Execute filtered query + count ──────────────────────────────────
    const [tickets, totalCount] = await Promise.all([
      prisma.ticket.findMany({
        where,
        orderBy,
        take: limit,
        skip: offset,
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
              creativePayoutTokens: true,
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
      }),
      prisma.ticket.count({ where }),
    ]);

    const response = {
      stats: {
        byStatus,
        total: allTickets.length,
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
          latestRevisionFeedbackSnippet = full.length > 180 ? full.slice(0, 177) + "..." : full;
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
                creativePayoutTokens: t.jobType.creativePayoutTokens,
              }
            : null,
          revisionCount: t.revisionCount ?? 0,
          latestRevisionHasFeedback,
          latestRevisionFeedbackSnippet,
        };
      }),
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount,
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error: any) {
    if ((error as any)?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    console.error("[creative.tickets] GET error", error);
    return NextResponse.json({ error: "Failed to load creative tickets" }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// PATCH: update ticket status (creatives cannot mark DONE, creates revisions)
//
// Plan bazlı concurrency kuralı:
// - Plan.maxConcurrentInProgressTickets değeri,
//   aynı company için eşzamanlı IN_PROGRESS ticket sayısının üst sınırıdır.
// - Sadece IN_PROGRESS'e geçişte kontrol edilir.
// - TODO / IN_REVIEW geçişleri bu limitten etkilenmez.
//
// Revision kuralı:
// - Creative tarafında IN_PROGRESS -> IN_REVIEW geçişinde:
//   - Ticket.revisionCount +1
//   - Aynı transaction içinde yeni bir TicketRevision kaydı oluşturulur.
//
// Creative note kuralı:
// - Admin tarafından creative için creativeRevisionNotesEnabled = true ise,
//   IN_PROGRESS -> IN_REVIEW geçişinde optional creativeMessage alır ve
//   TicketRevision.creativeMessage alanına yazar.
// - Flag false ise, gönderilen creativeMessage görmezden gelinir.
// -----------------------------------------------------------------------------

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (user.role !== "DESIGNER") {
      return NextResponse.json(
        { error: "Only creatives can update these tickets." },
        { status: 403 },
      );
    }

    const body = (await req.json()) as PatchPayload;
    const id = body.id;
    const requestedStatus = body.status;

    if (!id || !requestedStatus) {
      return NextResponse.json({ error: "Both id and status are required." }, { status: 400 });
    }
    if (!isValidTicketStatus(requestedStatus)) {
      return NextResponse.json({ error: "Invalid ticket status." }, { status: 400 });
    }

    const outcome = await transitionCreativeTicketStatus({
      creativeUserId: user.id,
      ticketId: id,
      nextStatus: requestedStatus as TicketStatus,
      creativeMessage: body.creativeMessage ?? null,
    });

    if (!outcome.success) {
      // Map structured errors to HTTP responses. The shape below matches
      // what the old inline implementation returned, so API consumers see
      // no change.
      if (outcome.code === "FORBIDDEN_DONE" || outcome.code === "ALREADY_DONE") {
        return NextResponse.json({ error: outcome.message }, { status: 403 });
      }
      if (outcome.code === "CREATIVE_NOT_FOUND") {
        return NextResponse.json({ error: outcome.message }, { status: 401 });
      }
      if (outcome.code === "NOT_FOUND") {
        return NextResponse.json({ error: outcome.message }, { status: 404 });
      }
      // CONCURRENCY_LIMIT
      return NextResponse.json(
        { error: outcome.message, details: outcome.details },
        { status: 400 },
      );
    }

    // Fire-and-forget notification. Kept in the route so the service
    // stays free of I/O side-effects beyond the DB transaction.
    createNotification({
      userId: outcome.notify.recipientUserId,
      type: outcome.notify.notificationType,
      title: outcome.notify.title,
      message: outcome.notify.message,
      ticketId: outcome.notify.ticketId,
      actorId: outcome.notify.actorId,
    });

    return NextResponse.json(
      {
        ticketId: outcome.result.ticketId,
        status: toTicketStatusString(outcome.result.status),
        updatedAt: outcome.result.updatedAt.toISOString(),
        ...(outcome.result.revisionId ? { revisionId: outcome.result.revisionId } : {}),
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[creative.tickets] PATCH error", error);
    return NextResponse.json({ error: "Failed to update ticket" }, { status: 500 });
  }
}
