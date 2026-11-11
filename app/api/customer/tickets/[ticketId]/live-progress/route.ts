// -----------------------------------------------------------------------------
// @file: app/api/customer/tickets/[ticketId]/live-progress/route.ts
// @purpose: What the customer's live progress card shows: where the request
//           is, and whether the creative's timer is running right now (with
//           the start of that sitting, so the card can count up). Totals of
//           time spent stay private to the creative and admins.
//           Owner switch: ENGAGEMENT_LIVE_PROGRESS.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { isEngagementOn } from "@/lib/engagement/switches.server";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ ticketId: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const user = await getCurrentUserOrThrow();
    if (user.role !== "CUSTOMER" || !user.activeCompanyId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!(await isEngagementOn("liveProgress"))) {
      return NextResponse.json({ enabled: false });
    }

    const { ticketId } = await params;
    const ticket = await prisma.ticket.findFirst({
      where: { id: ticketId, companyId: user.activeCompanyId },
      select: {
        status: true,
        creativeId: true,
        timeEntries: {
          where: { endedAt: null },
          orderBy: { startedAt: "desc" },
          take: 1,
          select: { startedAt: true },
        },
      },
    });
    if (!ticket) return NextResponse.json({ error: "Request not found" }, { status: 404 });

    const running = ticket.status === "IN_PROGRESS" ? ticket.timeEntries[0] : undefined;
    return NextResponse.json({
      enabled: true,
      status: ticket.status,
      isAssigned: ticket.creativeId != null,
      timerStartedAt: running ? running.startedAt.toISOString() : null,
    });
  } catch (err: any) {
    if (err?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[live-progress] GET error", err);
    return NextResponse.json({ error: "Failed to load progress" }, { status: 500 });
  }
}
