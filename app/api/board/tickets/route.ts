// -----------------------------------------------------------------------------
// @file: app/api/board/tickets/route.ts
// @purpose: API endpoint for board tickets (for main kanban view)
// @version: v1.0.0
// @lastUpdate: 2025-11-14
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildTicketCode } from "@/lib/ticket-code";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { isSiteAdminRole } from "@/lib/roles";

export async function GET() {
  try {
    // This board aggregates tickets across ALL companies (company names,
    // creative names, per-job token costs). It is an internal admin view —
    // gate it to site admins. Without this check the endpoint leaked every
    // company's ticket data to any unauthenticated caller.
    const user = await getCurrentUserOrThrow();
    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const tickets = await prisma.ticket.findMany({
      // Hide soft-cancelled tickets from the global board view.
      where: { status: { not: "CANCELED" } },
      include: {
        company: {
          select: {
            id: true,
            name: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        creative: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        jobType: {
          select: {
            id: true,
            name: true,
            tokenCost: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 200, // simple limit for v1
    });

    const payload = tickets.map((t) => {
      const code = buildTicketCode({
        projectCode: t.project?.code,
        companyTicketNumber: t.companyTicketNumber,
        ticketId: t.id,
      });

      return {
        id: t.id,
        code,
        title: t.title,
        status: t.status,
        priority: t.priority,
        projectName: t.project?.name ?? null,
        companyName: t.company?.name ?? null,
        creativeName: t.creative?.name ?? t.creative?.email ?? null,
        tokenCost: t.jobType?.tokenCost ?? null,
        createdAt: t.createdAt.toISOString(),
      };
    });

    return NextResponse.json({ tickets: payload });
  } catch (error) {
    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[board.tickets] GET error", error);
    return NextResponse.json({ error: "Failed to load board tickets" }, { status: 500 });
  }
}
