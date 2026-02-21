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

type RouteParams = {
  ticketId: string;
};

// Next 15+ bazen params'i Promise olarak geçirebiliyor, o yüzden ikisini de
// destekleyecek şekilde type tanımlıyoruz.
type RouteContext =
  | { params: RouteParams }
  | { params: Promise<RouteParams> };

// Küçük helper: params Promise ise await et, değilse direkt al
async function resolveParams(context: RouteContext): Promise<RouteParams> {
  const raw = (context as any).params;

  if (!raw) {
    return { ticketId: "" };
  }

  // Promise mi diye kabaca kontrol edelim
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
      return NextResponse.json(
        { error: "Ticket id is required." },
        { status: 400 },
      );
    }

    // Ticket bu creativea mı ait, onu doğrula
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
      return NextResponse.json(
        { error: "Ticket not found for this creative." },
        { status: 404 },
      );
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

    return NextResponse.json(
      {
        revisions: revisions.map((r) => ({
          version: r.version,
          submittedAt: r.submittedAt
            ? r.submittedAt.toISOString()
            : null,
          feedbackAt: r.feedbackAt ? r.feedbackAt.toISOString() : null,
          feedbackMessage: r.feedbackMessage ?? null,
          creativeMessage: r.creativeMessage ?? null,
          assets: (r as any).assets?.map((a: any) => ({
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

    console.error(
      "[GET /api/creative/tickets/[ticketId]/revisions] error",
      error,
    );

    return NextResponse.json(
      { error: "Failed to load revision history." },
      { status: 500 },
    );
  }
}
