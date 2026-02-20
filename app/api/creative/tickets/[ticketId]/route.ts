// -----------------------------------------------------------------------------
// @file: app/api/creative/tickets/[ticketId]/route.ts
// @purpose: Get a single ticket assigned to the current creative
// @version: v1.0.0
// @status: active
// @lastUpdate: 2025-11-18
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";

type RouteContext = {
  params: Promise<{
    ticketId: string;
  }>;
};

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const user = await getCurrentUserOrThrow();

    if (user.role !== "DESIGNER") {
      return NextResponse.json(
        { error: "Only creatives can access this endpoint" },
        { status: 403 },
      );
    }

    const { ticketId } = await params;

    if (!ticketId) {
      return NextResponse.json(
        { error: "Missing ticketId in route params" },
        { status: 400 },
      );
    }

    const ticket = await prisma.ticket.findFirst({
      where: {
        id: ticketId,
        creativeId: user.id,
      },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        jobType: {
          select: {
            id: true,
            name: true,
            tokenCost: true,
            creativePayoutTokens: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        creative: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!ticket) {
      return NextResponse.json(
        {
          error:
            "Ticket not found for this creative. It may belong to another creative or not exist.",
        },
        { status: 404 },
      );
    }

    // Effective payout for the creative (quantity × base, with possible override)
    const qty = ticket.quantity ?? 1;
    const effectivePayout = ticket.jobType
      ? (ticket.creativePayoutOverride ?? ticket.jobType.creativePayoutTokens * qty)
      : null;

    return NextResponse.json(
      {
        company: ticket.company,
        ticket: {
          id: ticket.id,
          title: ticket.title,
          description: ticket.description,
          status: ticket.status,
          priority: ticket.priority,
          dueDate: ticket.dueDate,
          createdAt: ticket.createdAt.toISOString(),
          updatedAt: ticket.updatedAt.toISOString(),
          companyTicketNumber: ticket.companyTicketNumber,
          quantity: qty,
          effectivePayout,
          project: ticket.project,
          jobType: ticket.jobType,
          creative: ticket.creative,
          createdBy: ticket.createdBy,
        },
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
      "[GET /api/creative/tickets/[ticketId]] error",
      error,
    );
    return NextResponse.json(
      { error: "Failed to load ticket detail" },
      { status: 500 },
    );
  }
}
