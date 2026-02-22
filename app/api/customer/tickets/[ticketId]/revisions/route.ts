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
import { resolveAssetUrl } from "@/lib/r2";

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
    return NextResponse.json({ error: "Ticket not found for your company." }, { status: 404 });
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
          storageKey: true,
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

  // Resolve presigned URLs for revision assets that don't have a public URL
  const enrichedRevisions = await Promise.all(
    revisions.map(async (rev) => ({
      version: rev.version,
      submittedAt: rev.submittedAt ? rev.submittedAt.toISOString() : null,
      feedbackAt: rev.feedbackAt ? rev.feedbackAt.toISOString() : null,
      feedbackMessage: rev.feedbackMessage ?? null,
      assets: await Promise.all(
        ((rev as any).assets ?? []).map(async (a: any) => ({
          id: a.id,
          url: await resolveAssetUrl(a.storageKey, a.url),
          mimeType: a.mimeType,
          bytes: a.bytes,
          width: a.width,
          height: a.height,
          originalName: a.originalName,
          pinCount: a.pins?.length ?? 0,
          openPins: a.pins?.filter((p: any) => p.status === "OPEN").length ?? 0,
          resolvedPins: a.pins?.filter((p: any) => p.status === "RESOLVED").length ?? 0,
        })),
      ),
    })),
  );

  return NextResponse.json({
    ticketId,
    revisions: enrichedRevisions,
  });
}
