// -----------------------------------------------------------------------------
// @file: app/api/creative/tickets/[ticketId]/revisions/route.ts
// @purpose: Creative-facing revision history API (includes creativeMessage)
// @version: v1.2.0
// @status: active
// @lastUpdate: 2025-12-25
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { resolveAssetUrl } from "@/lib/r2";

type RouteParams = {
  ticketId: string;
};

// Next 15+ sometimes passes params as a Promise; accept both shapes so we
// don't care which runtime resolves it.
type RouteContext = { params: RouteParams } | { params: Promise<RouteParams> };

// Small helper: await params when it's a Promise, otherwise return as-is.
async function resolveParams(context: RouteContext): Promise<RouteParams> {
  const raw = (context as any).params;

  if (!raw) {
    return { ticketId: "" };
  }

  // Rough check for whether this is a Promise
  if (typeof raw.then === "function") {
    return (await raw) as RouteParams;
  }

  return raw as RouteParams;
}

// -----------------------------------------------------------------------------
// GET /api/creative/tickets/[ticketId]/revisions
//  - Only DESIGNERs
//  - Ticket must belong to current creative
//  - Returns full revision timeline with creativeMessage + feedbackMessage
// -----------------------------------------------------------------------------

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUserOrThrow();

    if (user.role !== "DESIGNER") {
      return NextResponse.json(
        { error: "Only creatives can access revision history." },
        { status: 403 },
      );
    }

    const { ticketId } = await resolveParams(context);

    if (!ticketId) {
      return NextResponse.json({ error: "Ticket id is required." }, { status: 400 });
    }

    // Verify this ticket belongs to the current creative
    const ticket = await prisma.ticket.findFirst({
      where: {
        id: ticketId,
        creativeId: user.id,
      },
      select: {
        id: true,
      },
    });

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found for this creative." }, { status: 404 });
    }

    const revisions = await prisma.ticketRevision.findMany({
      where: { ticketId: ticket.id },
      orderBy: {
        version: "asc",
      },
      select: {
        version: true,
        submittedAt: true,
        feedbackAt: true,
        feedbackMessage: true,
        creativeMessage: true,
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
      revisions.map(async (r) => ({
        version: r.version,
        submittedAt: r.submittedAt ? r.submittedAt.toISOString() : null,
        feedbackAt: r.feedbackAt ? r.feedbackAt.toISOString() : null,
        feedbackMessage: r.feedbackMessage ?? null,
        creativeMessage: r.creativeMessage ?? null,
        assets: await Promise.all(
          ((r as any).assets ?? []).map(async (a: any) => ({
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

    return NextResponse.json({ revisions: enrichedRevisions }, { status: 200 });
  } catch (error: any) {
    if ((error as any)?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    console.error("[GET /api/creative/tickets/[ticketId]/revisions] error", error);

    return NextResponse.json({ error: "Failed to load revision history." }, { status: 500 });
  }
}
