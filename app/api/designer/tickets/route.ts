// -----------------------------------------------------------------------------
// @file: app/api/designer/tickets/route.ts
// @purpose: Designer API for listing and updating assigned tickets (status, no DONE)
// @version: v1.1.0
// @status: active
// @lastUpdate: 2025-11-16
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import {
  TicketStatus,
  TicketPriority,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";

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
};

type DesignerTicketsResponse = {
  stats: {
    byStatus: Record<TicketStatusString, number>;
    total: number;
  };
  tickets: DesignerTicket[];
};

type PatchPayload = {
  id?: string;
  status?: string;
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
      },
    });

    const byStatus: Record<TicketStatusString, number> = {
      TODO: 0,
      IN_PROGRESS: 0,
      IN_REVIEW: 0,
      DONE: 0,
    };

    for (const t of tickets) {
      const key = toTicketStatusString(t.status);
      byStatus[key] = (byStatus[key] ?? 0) + 1;
    }

    const response: DesignerTicketsResponse = {
      stats: {
        byStatus,
        total: tickets.length,
      },
      tickets: tickets.map((t) => ({
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
      })),
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
// PATCH: update ticket status (designers cannot mark DONE)
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

    // Designers are never allowed to set DONE
    if (nextStatus === TicketStatus.DONE) {
      return NextResponse.json(
        {
          error:
            "Designers cannot mark tickets as DONE. Please ask the client to close the ticket.",
        },
        { status: 403 },
      );
    }

    const ticket = await prisma.ticket.findFirst({
      where: {
        id,
        designerId: user.id,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!ticket) {
      return NextResponse.json(
        { error: "Ticket not found." },
        { status: 404 },
      );
    }

    // If already DONE (for any reason), designers should not be able to change it
    if (ticket.status === TicketStatus.DONE) {
      return NextResponse.json(
        {
          error:
            "This ticket is already marked as DONE and cannot be changed by a designer.",
        },
        { status: 403 },
      );
    }

    const updated = await prisma.ticket.update({
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

    return NextResponse.json(
      {
        ticketId: updated.id,
        status: toTicketStatusString(updated.status),
        updatedAt: updated.updatedAt.toISOString(),
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
