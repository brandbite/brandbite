// -----------------------------------------------------------------------------
// @file: app/api/customer/tickets/[ticketId]/route.ts
// @purpose: Get or update a single customer ticket (detail + status changes)
// @version: v1.1.1
// @status: active
// @lastUpdate: 2025-11-18
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TicketStatus, CompanyRole } from "@prisma/client";
import { getCurrentUserOrThrow } from "@/lib/auth";

type RouteContext = {
  params: Promise<{
    ticketId: string;
  }>;
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
// GET /api/customer/tickets/[ticketId]
// Tek bir ticket'ın detayını döner (sadece current company scope'unda)
// -----------------------------------------------------------------------------

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const user = await getCurrentUserOrThrow();

    if (user.role !== "CUSTOMER") {
      return NextResponse.json(
        { error: "Only customers can access customer tickets" },
        { status: 403 },
      );
    }

    if (!user.activeCompanyId) {
      return NextResponse.json(
        { error: "User has no active company" },
        { status: 400 },
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
        companyId: user.activeCompanyId,
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        designer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        jobType: {
          select: {
            id: true,
            name: true,
            tokenCost: true,
            designerPayoutTokens: true,
          },
        },
      },
    });

    if (!ticket) {
      return NextResponse.json(
        { error: "Ticket not found for current company" },
        { status: 404 },
      );
    }

    const code =
      ticket.project?.code && ticket.companyTicketNumber != null
        ? `${ticket.project.code}-${ticket.companyTicketNumber}`
        : ticket.companyTicketNumber != null
        ? `#${ticket.companyTicketNumber}`
        : ticket.id;

    return NextResponse.json(
      {
        ticket: {
          id: ticket.id,
          code,
          title: ticket.title,
          description: ticket.description,
          status: ticket.status,
          priority: ticket.priority,
          dueDate: ticket.dueDate?.toISOString() ?? null,
          companyTicketNumber: ticket.companyTicketNumber,
          createdAt: ticket.createdAt.toISOString(),
          updatedAt: ticket.updatedAt.toISOString(),
          project: ticket.project
            ? {
                id: ticket.project.id,
                name: ticket.project.name,
                code: ticket.project.code,
              }
            : null,
          designer: ticket.designer
            ? {
                id: ticket.designer.id,
                name: ticket.designer.name,
                email: ticket.designer.email,
              }
            : null,
          jobType: ticket.jobType
            ? {
                id: ticket.jobType.id,
                name: ticket.jobType.name,
                tokenCost: ticket.jobType.tokenCost,
                designerPayoutTokens:
                  ticket.jobType.designerPayoutTokens,
              }
            : null,
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

    console.error("[GET /api/customer/tickets/[ticketId]] error", error);
    return NextResponse.json(
      { error: "Failed to load ticket" },
      { status: 500 },
    );
  }
}

// -----------------------------------------------------------------------------
// PATCH /api/customer/tickets/[ticketId]
// Body: { status: "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE" }
// -----------------------------------------------------------------------------

export async function PATCH(req: NextRequest, { params }: RouteContext) {
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

    const { ticketId } = await params;

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

    const rawStatus = String((body as any).status ?? "")
      .trim()
      .toUpperCase();

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
