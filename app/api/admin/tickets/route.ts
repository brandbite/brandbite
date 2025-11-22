// -----------------------------------------------------------------------------
// @file: app/api/admin/tickets/route.ts
// @purpose: Admin ticket list + manual designer assignment API
// @version: v0.1.0
// @status: experimental
// @lastUpdate: 2025-11-21
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";

type AssignPayload = {
  ticketId?: string;
  designerId?: string | null;
};

export async function GET(_req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    const isSiteAdmin =
      user.role === "SITE_OWNER" || user.role === "SITE_ADMIN";

    if (!isSiteAdmin) {
      return NextResponse.json(
        {
          error:
            "Only site owners or admins can access this endpoint.",
        },
        { status: 403 },
      );
    }

    const [tickets, designers] = await Promise.all([
      prisma.ticket.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          status: true,
          createdAt: true,
          company: {
            select: {
              id: true,
              name: true,
            },
          },
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
        },
      }),
      prisma.userAccount.findMany({
        where: {
          role: UserRole.DESIGNER,
        },
        select: {
          id: true,
          name: true,
          email: true,
        },
        orderBy: {
          name: "asc",
        },
      }),
    ]);

    return NextResponse.json(
      {
        tickets,
        designers,
      },
      { status: 200 },
    );
  } catch (error: any) {
    if (error?.code === "UNAUTHENTICATED") {
      return NextResponse.json(
        { error: "Unauthenticated" },
        { status: 401 },
      );
    }

    console.error("[GET /api/admin/tickets] error", error);
    return NextResponse.json(
      { error: "Failed to load tickets" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    const isSiteAdmin =
      user.role === "SITE_OWNER" || user.role === "SITE_ADMIN";

    if (!isSiteAdmin) {
      return NextResponse.json(
        {
          error:
            "Only site owners or admins can assign designers.",
        },
        { status: 403 },
      );
    }

    const body = (await req.json()) as AssignPayload;
    const ticketId = body.ticketId;
    const designerId = body.designerId ?? null;

    if (!ticketId) {
      return NextResponse.json(
        { error: "ticketId is required." },
        { status: 400 },
      );
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true },
    });

    if (!ticket) {
      return NextResponse.json(
        { error: "Ticket not found." },
        { status: 404 },
      );
    }

    if (designerId) {
      const designer = await prisma.userAccount.findFirst({
        where: {
          id: designerId,
          role: UserRole.DESIGNER,
        },
        select: {
          id: true,
        },
      });

      if (!designer) {
        return NextResponse.json(
          {
            error:
              "Designer not found or not a designer.",
          },
          { status: 400 },
        );
      }
    }

    const updated = await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        designerId: designerId,
      },
      select: {
        id: true,
        designer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // İlerde istersen TicketAssignmentLog ile MANUAL log da ekleyebiliriz.

    return NextResponse.json(updated, { status: 200 });
  } catch (error: any) {
    if (error?.code === "UNAUTHENTICATED") {
      return NextResponse.json(
        { error: "Unauthenticated" },
        { status: 401 },
      );
    }

    console.error("[PATCH /api/admin/tickets] error", error);
    return NextResponse.json(
      { error: "Failed to assign designer" },
      { status: 500 },
    );
  }
}
