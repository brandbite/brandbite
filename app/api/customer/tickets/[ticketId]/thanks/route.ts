// -----------------------------------------------------------------------------
// @file: app/api/customer/tickets/[ticketId]/thanks/route.ts
// @purpose: A customer thanks the creative with one-tap tags after approving
//           a request. Once per request; the creative is notified and the
//           tags collect on their profile. Owner switch: ENGAGEMENT_THANK_YOUS.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { isEngagementOn } from "@/lib/engagement/switches.server";
import { cleanThanksTags, thanksSentence } from "@/lib/engagement/thanks";
import { createNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ ticketId: string }> };

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const user = await getCurrentUserOrThrow();
    if (user.role !== "CUSTOMER" || !user.activeCompanyId) {
      return NextResponse.json({ error: "Only customers can send thanks" }, { status: 403 });
    }
    if (!(await isEngagementOn("thankYous"))) {
      return NextResponse.json({ error: "Thank-yous are switched off" }, { status: 404 });
    }

    const { ticketId } = await params;
    const body = (await req.json().catch(() => null)) as { tags?: unknown } | null;
    const tags = cleanThanksTags(body?.tags);
    if (tags.length === 0) {
      return NextResponse.json({ error: "Pick at least one tag" }, { status: 400 });
    }

    const ticket = await prisma.ticket.findFirst({
      where: { id: ticketId, companyId: user.activeCompanyId },
      select: { id: true, status: true, creativeId: true, companyId: true, title: true },
    });
    if (!ticket) return NextResponse.json({ error: "Request not found" }, { status: 404 });
    if (ticket.status !== "DONE") {
      return NextResponse.json(
        { error: "You can thank your creative once the request is approved" },
        { status: 409 },
      );
    }
    if (!ticket.creativeId) {
      return NextResponse.json({ error: "This request has no creative" }, { status: 409 });
    }

    try {
      await prisma.ticketThanks.create({
        data: {
          ticketId: ticket.id,
          creativeId: ticket.creativeId,
          givenByUserId: user.id,
          companyId: ticket.companyId,
          tags,
        },
      });
    } catch (err: any) {
      if (err?.code === "P2002") {
        return NextResponse.json(
          { error: "Thanks were already sent for this request" },
          { status: 409 },
        );
      }
      throw err;
    }

    await createNotification({
      userId: ticket.creativeId,
      type: "THANKS_RECEIVED",
      title: "A customer thanked you",
      message: `${thanksSentence(tags)} on "${ticket.title}".`,
      ticketId: ticket.id,
      actorId: user.id,
    });

    return NextResponse.json({ tags }, { status: 201 });
  } catch (err: any) {
    if (err?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[thanks] POST error", err);
    return NextResponse.json({ error: "Failed to send thanks" }, { status: 500 });
  }
}
