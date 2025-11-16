// -----------------------------------------------------------------------------
// @file: app/api/customer/tickets/status/route.ts
// @purpose: Update ticket status for customer board (kanban)
// @version: v1.3.0
// @status: active
// @lastUpdate: 2025-11-16
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { TicketStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import {
  canMoveTicketsOnBoard,
  canMarkTicketsDoneForCompany,
  normalizeCompanyRole,
} from "@/lib/permissions/companyRoles";

type PatchPayload = {
  ticketId?: string;
  status?: string;
};

function isValidTicketStatus(value: unknown): value is TicketStatus {
  if (typeof value !== "string") return false;
  return (
    value === "TODO" ||
    value === "IN_PROGRESS" ||
    value === "IN_REVIEW" ||
    value === "DONE"
  );
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    // Only customers + site admins can use this endpoint
    const isSiteAdmin =
      user.role === "SITE_OWNER" || user.role === "SITE_ADMIN";

    if (!isSiteAdmin && user.role !== "CUSTOMER") {
      return NextResponse.json(
        {
          error:
            "Only customers or site administrators can update ticket status from this endpoint.",
        },
        { status: 403 },
      );
    }

    const body = (await req.json()) as PatchPayload;
    const ticketId = body.ticketId;
    const requestedStatus = body.status;

    if (!ticketId || !requestedStatus) {
      return NextResponse.json(
        { error: "Both ticketId and status are required." },
        { status: 400 },
      );
    }

    if (!isValidTicketStatus(requestedStatus)) {
      return NextResponse.json(
        { error: "Invalid ticket status." },
        { status: 400 },
      );
    }

    const nextStatus = requestedStatus as TicketStatus;

    // -------------------------------------------------------------------------
    // Load ticket with proper scoping
    // -------------------------------------------------------------------------

    const where =
      user.role === "CUSTOMER" && user.activeCompanyId
        ? {
            id: ticketId,
            companyId: user.activeCompanyId,
          }
        : {
            id: ticketId,
          };

    const ticket = await prisma.ticket.findFirst({
      where,
      select: {
        id: true,
        status: true,
        companyId: true,
      },
    });

    if (!ticket) {
      return NextResponse.json(
        { error: "Ticket not found." },
        { status: 404 },
      );
    }

    // -------------------------------------------------------------------------
    // Board-level permission: can this user move tickets at all?
    // - Site admins: always yes
    // - Customers: based on companyRole
    // -------------------------------------------------------------------------

    const normalizedCompanyRole = normalizeCompanyRole(
      user.companyRole ?? null,
    );

    if (!isSiteAdmin) {
      if (!canMoveTicketsOnBoard(normalizedCompanyRole)) {
        return NextResponse.json(
          {
            error:
              "You don't have permission to move tickets on the board for this company.",
          },
          { status: 403 },
        );
      }
    }

    // -------------------------------------------------------------------------
    // DONE transition: special permission rule
    // -------------------------------------------------------------------------

    const isDoneTransition =
      ticket.status !== TicketStatus.DONE &&
      nextStatus === TicketStatus.DONE;

    if (isDoneTransition) {
      const canMarkDone = canMarkTicketsDoneForCompany(
        user.role,
        normalizedCompanyRole,
      );

      if (!canMarkDone) {
        return NextResponse.json(
          {
            error:
              "You don't have permission to mark this ticket as DONE. Please ask your company owner or project manager.",
          },
          { status: 403 },
        );
      }

      // NOTE:
      // Burada şimdilik sadece status güncelliyoruz.
      // Designer payout / company token DEBIT mantığını ileride
      // merkezi bir "complete ticket" endpoint'i ile bağlayacağız.
    }

    // -------------------------------------------------------------------------
    // Normal status update
    // -------------------------------------------------------------------------

    const updated = await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        status: nextStatus,
      },
      select: {
        id: true,
        status: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (error: any) {
    if ((error as any)?.code === "UNAUTHENTICATED") {
      return NextResponse.json(
        { error: "Unauthenticated" },
        { status: 401 },
      );
    }

    console.error(
      "[PATCH /api/customer/tickets/status] error",
      error,
    );
    return NextResponse.json(
      { error: "Failed to update ticket status" },
      { status: 500 },
    );
  }
}
