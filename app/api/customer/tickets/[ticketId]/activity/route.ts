// -----------------------------------------------------------------------------
// @file: app/api/customer/tickets/[ticketId]/activity/route.ts
// @purpose: Activity timeline for one ticket, as a customer in its company sees it
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildTicketActivity } from "@/lib/tickets/ticket-activity";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> },
) {
  try {
    const user = await getCurrentUserOrThrow();
    const { ticketId } = await params;

    if (user.role !== "CUSTOMER") {
      return NextResponse.json({ error: "Only customers can view this" }, { status: 403 });
    }
    if (!user.activeCompanyId) {
      return NextResponse.json({ error: "User has no active company" }, { status: 400 });
    }

    const ticket = await prisma.ticket.findFirst({
      where: { id: ticketId, companyId: user.activeCompanyId },
      select: { id: true },
    });
    const activity =
      ticket && (await buildTicketActivity(ticket.id, { kind: "customer", userId: user.id }));
    if (!activity) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    return NextResponse.json(activity);
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    console.error("[customer.tickets.activity] GET error", error);
    return NextResponse.json({ error: "Failed to load activity" }, { status: 500 });
  }
}
