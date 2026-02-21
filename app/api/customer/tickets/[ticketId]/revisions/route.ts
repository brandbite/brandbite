// -----------------------------------------------------------------------------
// @file: app/api/customer/tickets/[ticketId]/revisions/route.ts
// @purpose: Fetch revision history for a single ticket from the customer side
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

  if (user.role !== "CUSTOMER") {
    return NextResponse.json(
      { error: "Only customers can view ticket revision history." },
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
      assets: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          url: true,
          mimeType: true,
          bytes: true,
          width: true,
          height: true,
          originalName: true,
          pins: { select: { status: true } },
        },
      },
    },
  });

  return NextResponse.json({
    ticketId,
    revisions: revisions.map((rev) => ({
      version: rev.version,
      submittedAt: rev.submittedAt ? rev.submittedAt.toISOString() : null,
      feedbackAt: rev.feedbackAt ? rev.feedbackAt.toISOString() : null,
      feedbackMessage: rev.feedbackMessage ?? null,
      assets: (rev as any).assets?.map((a: any) => ({
        id: a.id,
        url: a.url,
        mimeType: a.mimeType,
        bytes: a.bytes,
        width: a.width,
        height: a.height,
        originalName: a.originalName,
        pinCount: a.pins?.length ?? 0,
        openPins: a.pins?.filter((p: any) => p.status === "OPEN").length ?? 0,
        resolvedPins: a.pins?.filter((p: any) => p.status === "RESOLVED").length ?? 0,
      })) ?? [],
    })),
  });
}
