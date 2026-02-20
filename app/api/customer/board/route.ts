// -----------------------------------------------------------------------------
// @file: app/api/customer/board/route.ts
// @purpose: Customer API for board-style overview of company tickets
// @version: v1.0.0
// @status: active
// @lastUpdate: 2025-11-15
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";

type TicketStatusString = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";

const STATUS_LIST: TicketStatusString[] = [
  "TODO",
  "IN_PROGRESS",
  "IN_REVIEW",
  "DONE",
];

export async function GET(_req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (user.role !== "CUSTOMER") {
      return NextResponse.json(
        { error: "Only customers can access the customer board" },
        { status: 403 },
      );
    }

    if (!user.activeCompanyId) {
      return NextResponse.json(
        { error: "No active company set for this user" },
        { status: 400 },
      );
    }

    const tickets = await prisma.ticket.findMany({
      where: {
        companyId: user.activeCompanyId,
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
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
            designerPayoutTokens: true,
          },
        },
      },
    });

    const statsByStatus: Record<TicketStatusString, number> = {
      TODO: 0,
      IN_PROGRESS: 0,
      IN_REVIEW: 0,
      DONE: 0,
    };

    for (const t of tickets) {
      const s = t.status as TicketStatusString;
      if (statsByStatus[s] != null) {
        statsByStatus[s] += 1;
      }
    }

    const dto = tickets.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status as TicketStatusString,
      priority: t.priority,
      dueDate: t.dueDate ? t.dueDate.toISOString() : null,
      companyTicketNumber: t.companyTicketNumber,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
      project: t.project
        ? {
            id: t.project.id,
            name: t.project.name,
            code: t.project.code,
          }
        : null,
      isAssigned: t.designerId != null,
      jobType: t.jobType
        ? {
            id: t.jobType.id,
            name: t.jobType.name,
            tokenCost: t.jobType.tokenCost,
            designerPayoutTokens: t.jobType.designerPayoutTokens,
          }
        : null,
    }));

    return NextResponse.json({
      stats: {
        byStatus: statsByStatus,
        total: tickets.length,
      },
      tickets: dto,
    });
  } catch (error: any) {
    if ((error as any)?.code === "UNAUTHENTICATED") {
      return NextResponse.json(
        { error: "Unauthenticated" },
        { status: 401 },
      );
    }

    console.error("[customer.board] GET error", error);
    return NextResponse.json(
      { error: "Failed to load customer board" },
      { status: 500 },
    );
  }
}
