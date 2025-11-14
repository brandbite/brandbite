// -----------------------------------------------------------------------------
// @file: app/api/board/tickets/route.ts
// @purpose: API endpoint for board tickets (for main kanban view)
// @version: v1.0.0
// @lastUpdate: 2025-11-14
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const tickets = await prisma.ticket.findMany({
      include: {
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
        jobType: {
          select: {
            id: true,
            name: true,
            tokenCost: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 200, // simple limit for v1
    });

    const payload = tickets.map((t) => {
      // Display code: PROJECTCODE-123, #123 or fallback to id
      const code =
        t.project?.code && t.companyTicketNumber != null
          ? `${t.project.code}-${t.companyTicketNumber}`
          : t.companyTicketNumber != null
          ? `#${t.companyTicketNumber}`
          : t.id;

      return {
        id: t.id,
        code,
        title: t.title,
        status: t.status,
        priority: t.priority,
        projectName: t.project?.name ?? null,
        companyName: t.company?.name ?? null,
        designerName: t.designer?.name ?? t.designer?.email ?? null,
        tokenCost: t.jobType?.tokenCost ?? null,
        createdAt: t.createdAt.toISOString(),
      };
    });

    return NextResponse.json({ tickets: payload });
  } catch (error) {
    console.error("[board.tickets] GET error", error);
    return NextResponse.json(
      { error: "Failed to load board tickets" },
      { status: 500 }
    );
  }
}
