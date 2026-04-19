// -----------------------------------------------------------------------------
// @file: app/api/customer/tickets/[ticketId]/rating/route.ts
// @purpose: Customer-side endpoint for submitting a creative rating after a
//           ticket is marked DONE. One rating per ticket (unique constraint
//           in the DB guarantees this). Admin-only insight — the creative
//           never sees these values directly.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/schemas/helpers";
import { submitRatingSchema } from "@/lib/schemas/rating.schemas";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> },
) {
  try {
    const user = await getCurrentUserOrThrow();

    if (user.role !== "CUSTOMER") {
      return NextResponse.json({ error: "Only customers can submit ratings" }, { status: 403 });
    }
    if (!user.activeCompanyId) {
      return NextResponse.json({ error: "No active company" }, { status: 400 });
    }

    const { ticketId } = await params;
    const parsed = await parseBody(req, submitRatingSchema);
    if (!parsed.success) return parsed.response;

    // Only rateable after the ticket is DONE and the creative is known.
    const ticket = await prisma.ticket.findFirst({
      where: { id: ticketId, companyId: user.activeCompanyId },
      select: {
        id: true,
        status: true,
        creativeId: true,
        companyId: true,
      },
    });

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }
    if (ticket.status !== "DONE") {
      return NextResponse.json(
        { error: "Ticket must be marked DONE before it can be rated" },
        { status: 409 },
      );
    }
    if (!ticket.creativeId) {
      return NextResponse.json(
        { error: "Ticket has no assigned creative to rate" },
        { status: 409 },
      );
    }

    // One rating per ticket — submission is create-once. If the customer needs
    // to revise a rating, an admin can delete the row and they can submit again.
    // We use `create` rather than `upsert` so accidentally calling this route
    // twice returns a clear 409 instead of silently overwriting a prior rating.
    const existing = await prisma.creativeRating.findUnique({
      where: { ticketId },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ error: "This ticket has already been rated" }, { status: 409 });
    }

    const rating = await prisma.creativeRating.create({
      data: {
        ticketId,
        creativeId: ticket.creativeId,
        ratedByUserId: user.id,
        companyId: ticket.companyId,
        quality: parsed.data.quality,
        communication: parsed.data.communication,
        speed: parsed.data.speed,
        feedback: parsed.data.feedback ?? null,
      },
    });

    return NextResponse.json(
      {
        rating: {
          id: rating.id,
          quality: rating.quality,
          communication: rating.communication,
          speed: rating.speed,
          feedback: rating.feedback,
          createdAt: rating.createdAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[customer/tickets/rating] POST error", error);
    return NextResponse.json({ error: "Failed to submit rating" }, { status: 500 });
  }
}
