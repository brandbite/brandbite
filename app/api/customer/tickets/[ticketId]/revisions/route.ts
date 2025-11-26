// -----------------------------------------------------------------------------
// @file: app/api/customer/tickets/[ticketId]/revisions/route.ts
// @purpose: Fetch revision history for a single ticket from the customer side
// @version: v1.0.0
// @status: active
// @lastUpdate: 2025-11-24
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";

type RouteContext = {
  params: {
    ticketId: string;
  };
};

export async function GET(_req: NextRequest, context: RouteContext) {
  const user = await getCurrentUserOrThrow();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role !== "CUSTOMER") {
    return NextResponse.json(
      { error: "Only customers can view ticket revision history." },
      { status: 403 },
    );
  }

  const ticketId = context.params.ticketId;
  if (!ticketId) {
    return NextResponse.json({ error: "Ticket id is required." }, { status: 400 });
  }

  const activeCompanyId = user.activeCompanyId;
  if (!activeCompanyId) {
    return NextResponse.json(
      { error: "You need an active company to view ticket revisions." },
      { status: 400 },
    );
  }

  const ticket = await prisma.ticket.findFirst({
    where: {
      id: ticketId,
      companyId: activeCompanyId,
    },
    select: { id: true },
  });

  if (!ticket) {
    return NextResponse.json(
      { error: "Ticket not found for your company." },
      { status: 404 },
    );
  }

  const revisions = await prisma.ticketRevision.findMany({
    where: {
      ticketId,
    },
    orderBy: {
      version: "asc",
    },
    select: {
      version: true,
      submittedAt: true,
      feedbackAt: true,
      feedbackMessage: true,
    },
  });

  return NextResponse.json({
    ticketId,
    revisions: revisions.map((rev) => ({
      version: rev.version,
      submittedAt: rev.submittedAt ? rev.submittedAt.toISOString() : null,
      feedbackAt: rev.feedbackAt ? rev.feedbackAt.toISOString() : null,
      feedbackMessage: rev.feedbackMessage ?? null,
    })),
  });
}
