// -----------------------------------------------------------------------------
// @file: app/api/customer/tickets/[ticketId]/route.ts
// @purpose: Update a single customer ticket (e.g. status from board drag & drop)
// @version: v1.0.0
// @status: active
// @lastUpdate: 2025-11-16
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TicketStatus, CompanyRole } from "@prisma/client";
import { getCurrentUserOrThrow } from "@/lib/auth";

type RouteParams = {
  params: {
    ticketId: string;
  };
};

// Board üzerinden status değiştirebilecek roller:
// - OWNER
// - PM
// - MEMBER
// (BILLING sadece finans odaklı, o yüzden şimdilik hariç bırakıyoruz)
const ALLOWED_UPDATE_ROLES: CompanyRole[] = ["OWNER", "PM", "MEMBER"];

// Güvenli tarafta kalmak için izin verilen status seti:
const ALLOWED_STATUSES: TicketStatus[] = [
  "TODO",
  "IN_PROGRESS",
  "IN_REVIEW",
  "DONE",
];

// -----------------------------------------------------------------------------
// PATCH /api/customer/tickets/[ticketId]
// Body: { status: "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE" }
// -----------------------------------------------------------------------------

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUserOrThrow();

    // Sadece CUSTOMER rolü ticket update edebilsin
    if (user.role !== "CUSTOMER") {
      return NextResponse.json(
        { error: "Only customers can update tickets" },
        { status: 403 },
      );
    }

    if (!user.activeCompanyId) {
      return NextResponse.json(
        { error: "User has no active company" },
        { status: 400 },
      );
    }

    if (
      !user.companyRole ||
      !ALLOWED_UPDATE_ROLES.includes(user.companyRole as CompanyRole)
    ) {
      return NextResponse.json(
        {
          error:
            "Only company owners, project managers or members can update tickets",
        },
        { status: 403 },
      );
    }

    const ticketId = params.ticketId;

    if (!ticketId) {
      return NextResponse.json(
        { error: "Missing ticketId in route params" },
        { status: 400 },
      );
    }

    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }

    const rawStatus = String((body as any).status ?? "").trim().toUpperCase();

    if (!ALLOWED_STATUSES.includes(rawStatus as TicketStatus)) {
      return NextResponse.json(
        {
          error:
            "Invalid status. Allowed values: TODO, IN_PROGRESS, IN_REVIEW, DONE",
        },
        { status: 400 },
      );
    }

    // Ticket bu kullanıcının aktif company’sine mi ait, onu doğrulayalım
    const existing = await prisma.ticket.findFirst({
      where: {
        id: ticketId,
        companyId: user.activeCompanyId,
      },
      select: {
        id: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Ticket not found for current company" },
        { status: 404 },
      );
    }

    const updated = await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: rawStatus as TicketStatus,
      },
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

    console.error(
      "[PATCH /api/customer/tickets/[ticketId]] error",
      error,
    );
    return NextResponse.json(
      { error: "Failed to update ticket" },
      { status: 500 },
    );
  }
}
