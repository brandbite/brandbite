// -----------------------------------------------------------------------------
// @file: app/api/creative/tickets/[ticketId]/comments/route.ts
// @purpose: List and create comments for a creative ticket
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

// Prisma client için tip hack'i (TicketComment delegate'i VSCode tipinde görünmüyorsa)
const prismaAny = prisma as any;

// -----------------------------------------------------------------------------
// GET /api/creative/tickets/[ticketId]/comments
// -----------------------------------------------------------------------------

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const user = await getCurrentUserOrThrow();

    if (user.role !== "DESIGNER") {
      return NextResponse.json(
        { error: "Only creatives can view ticket comments on this endpoint" },
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

    // Ticket gerçekten bu creativea mı ait?
    const ticket = await prisma.ticket.findFirst({
      where: {
        id: ticketId,
        creativeId: user.id,
      },
      select: { id: true },
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
      return NextResponse.json(
        { error: "Unauthenticated" },
        { status: 401 },
      );
    }

    console.error(
      "[GET /api/creative/tickets/[ticketId]/comments] error",
      error,
    );
    return NextResponse.json(
      { error: "Failed to load comments" },
      { status: 500 },
    );
  }
}

// -----------------------------------------------------------------------------
// POST /api/creative/tickets/[ticketId]/comments
// Body: { body: string }
// -----------------------------------------------------------------------------

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const user = await getCurrentUserOrThrow();

    if (user.role !== "DESIGNER") {
      return NextResponse.json(
        { error: "Only creatives can add comments on this endpoint" },
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

    const bodyJson = await req.json().catch(() => null);

    if (!bodyJson || typeof bodyJson !== "object") {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }

    const rawBody = String((bodyJson as any).body ?? "").trim();

    if (!rawBody) {
      return NextResponse.json(
        { error: "Comment body is required" },
        { status: 400 },
      );
    }

    if (rawBody.length > 2000) {
      return NextResponse.json(
        { error: "Comment is too long (max 2000 characters)" },
        { status: 400 },
      );
    }

    // Ticket gerçekten bu creativea mı ait?
    const ticket = await prisma.ticket.findFirst({
      where: {
        id: ticketId,
        creativeId: user.id,
      },
      select: { id: true },
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
      return NextResponse.json(
        { error: "Unauthenticated" },
        { status: 401 },
      );
    }

    console.error(
      "[POST /api/creative/tickets/[ticketId]/comments] error",
      error,
    );
    return NextResponse.json(
      { error: "Failed to add comment" },
      { status: 500 },
    );
  }
}
