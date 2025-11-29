// -----------------------------------------------------------------------------
// @file: app/api/designer/tickets/[ticketId]/revisions/route.ts
// @purpose: Fetch revision history for a single ticket from the designer side
// @version: v1.0.1
// @status: active
// @lastUpdate: 2025-11-26
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> },
) {
  const user = await getCurrentUserOrThrow();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role !== "DESIGNER") {
    return NextResponse.json(
      { error: "Only designers can view this revision history." },
      { status: 403 },
    );
  }

  const { ticketId } = await params;

  if (!ticketId) {
    return NextResponse.json(
      { error: "Ticket id is required." },
      { status: 400 },
    );
  }

  const ticket = await prisma.ticket.findFirst({
    where: {
      id: ticketId,
      designerId: user.id,
    },
    select: { id: true },
  });

  if (!ticket) {
    return NextResponse.json(
      { error: "Ticket not found or not assigned to you." },
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
