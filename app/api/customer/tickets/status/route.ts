// -----------------------------------------------------------------------------
// @file: app/api/customer/tickets/status/route.ts
// @purpose: Update ticket status for customer board (kanban)
// @version: v1.2.0
// @status: active
// @lastUpdate: 2025-11-16
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { TicketStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { canMoveTicketsOnBoard } from "@/lib/permissions/companyRoles";

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (user.role !== "CUSTOMER") {
      return NextResponse.json(
        { error: "Only customer accounts can update tickets from the board" },
        { status: 403 },
      );
    }

    if (!user.activeCompanyId) {
      return NextResponse.json(
        { error: "User has no active company" },
        { status: 400 },
      );
    }

    // Company-level permission check: who can move tickets on the board
    if (!canMoveTicketsOnBoard(user.companyRole ?? null)) {
      return NextResponse.json(
        {
          error:
            "You don't have permission to update ticket status for this company. Please ask your company owner or project manager.",
        },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }

    const ticketId = String((body as any).ticketId ?? "").trim();
    const rawStatus = String((body as any).status ?? "").trim();

    if (!ticketId) {
      return NextResponse.json(
        { error: "ticketId is required" },
        { status: 400 },
      );
    }

    if (!rawStatus) {
      return NextResponse.json(
        { error: "status is required" },
        { status: 400 },
      );
    }

    const allowedStatuses = Object.values(TicketStatus) as string[];

    if (!allowedStatuses.includes(rawStatus)) {
      return NextResponse.json(
        {
          error: `Invalid status value: ${rawStatus}. Allowed values: ${allowedStatuses.join(
            ", ",
          )}`,
        },
        { status: 400 },
      );
    }

    const nextStatus = rawStatus as TicketStatus;

    // Ensure ticket belongs to the active company of this customer
    const ticket = await prisma.ticket.findFirst({
      where: {
        id: ticketId,
        companyId: user.activeCompanyId,
      },
      select: {
        id: true,
        status: true,
        companyId: true,
      },
    });

    if (!ticket) {
      return NextResponse.json(
        { error: "Ticket not found for this company" },
        { status: 404 },
      );
    }

    if (ticket.status === nextStatus) {
      // No-op, but return OK for idempotency
      return NextResponse.json(
        {
          ticket: {
            id: ticket.id,
            status: ticket.status,
          },
        },
        { status: 200 },
      );
    }

    const updated = await prisma.ticket.update({
      where: { id: ticket.id },
      data: { status: nextStatus },
      select: {
        id: true,
        status: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(
      {
        ticket: {
          id: updated.id,
          status: updated.status,
          updatedAt: updated.updatedAt.toISOString(),
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

    console.error("[PATCH /api/customer/tickets/status] error", error);
    return NextResponse.json(
      { error: "Failed to update ticket status" },
      { status: 500 },
    );
  }
}
