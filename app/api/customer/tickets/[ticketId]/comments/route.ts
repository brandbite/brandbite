// -----------------------------------------------------------------------------
// @file: app/api/customer/tickets/[ticketId]/comments/route.ts
// @purpose: List and create comments for a customer ticket
// @version: v1.0.1
// @status: active
// @lastUpdate: 2025-11-18
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { parseBody } from "@/lib/schemas/helpers";
import { createCommentSchema } from "@/lib/schemas/comment.schemas";

type RouteContext = {
  params: Promise<{
    ticketId: string;
  }>;
};

// Prisma client için tip hack'i (TicketComment delegate'i henüz type tarafında görünmüyorsa)
const prismaAny = prisma as any;

// -----------------------------------------------------------------------------
// GET /api/customer/tickets/[ticketId]/comments
// -----------------------------------------------------------------------------

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const user = await getCurrentUserOrThrow();

    if (user.role !== "CUSTOMER") {
      return NextResponse.json(
        { error: "Only customers can view ticket comments on this endpoint" },
        { status: 403 },
      );
    }

    if (!user.activeCompanyId) {
      return NextResponse.json({ error: "User has no active company" }, { status: 400 });
    }

    const { ticketId } = await params;

    if (!ticketId) {
      return NextResponse.json({ error: "Missing ticketId in route params" }, { status: 400 });
    }

    // Ticket gerçekten bu company'e ait mi?
    const ticket = await prisma.ticket.findFirst({
      where: {
        id: ticketId,
        companyId: user.activeCompanyId,
      },
      select: { id: true },
    });

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found for current company" }, { status: 404 });
    }

    const comments = await prismaAny.ticketComment.findMany({
      where: { ticketId },
      orderBy: { createdAt: "asc" },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        comments: (comments as any[]).map((c: any) => ({
          id: c.id,
          body: c.body,
          createdAt: c.createdAt.toISOString(),
          author: {
            id: c.author.id,
            name: c.author.name,
            email: c.author.email,
            role: c.author.role,
          },
        })),
      },
      { status: 200 },
    );
  } catch (error: any) {
    if ((error as any)?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    console.error("[GET /api/customer/tickets/[ticketId]/comments] error", error);
    return NextResponse.json({ error: "Failed to load comments" }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// POST /api/customer/tickets/[ticketId]/comments
// Body: { body: string }
// -----------------------------------------------------------------------------

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const user = await getCurrentUserOrThrow();

    if (user.role !== "CUSTOMER") {
      return NextResponse.json(
        { error: "Only customers can add comments on this endpoint" },
        { status: 403 },
      );
    }

    if (!user.activeCompanyId) {
      return NextResponse.json({ error: "User has no active company" }, { status: 400 });
    }

    const { ticketId } = await params;

    if (!ticketId) {
      return NextResponse.json({ error: "Missing ticketId in route params" }, { status: 400 });
    }

    const parsed = await parseBody(req, createCommentSchema);
    if (!parsed.success) return parsed.response;
    const rawBody = parsed.data.body;

    // Ticket gerçekten bu company'e ait mi?
    const ticket = await prisma.ticket.findFirst({
      where: {
        id: ticketId,
        companyId: user.activeCompanyId,
      },
      select: { id: true },
    });

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found for current company" }, { status: 404 });
    }

    const created = await prismaAny.ticketComment.create({
      data: {
        ticketId,
        authorId: user.id,
        body: rawBody,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    const c = created as any;

    return NextResponse.json(
      {
        comment: {
          id: c.id,
          body: c.body,
          createdAt: c.createdAt.toISOString(),
          author: {
            id: c.author.id,
            name: c.author.name,
            email: c.author.email,
            role: c.author.role,
          },
        },
      },
      { status: 201 },
    );
  } catch (error: any) {
    if ((error as any)?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    console.error("[POST /api/customer/tickets/[ticketId]/comments] error", error);
    return NextResponse.json({ error: "Failed to add comment" }, { status: 500 });
  }
}
