// -----------------------------------------------------------------------------
// @file: app/api/customer/tokens/route.ts
// @purpose: Customer token balance & ledger API (session-based company)
// @version: v1.2.0
// @status: active
// @lastUpdate: 2025-11-14
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { LedgerDirection } from "@prisma/client";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { buildTicketCode } from "@/lib/ticket-code";

// -----------------------------------------------------------------------------
// GET: token balance + recent ledger entries for current customer's company
// -----------------------------------------------------------------------------

export async function GET(_req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (user.role !== "CUSTOMER") {
      return NextResponse.json(
        { error: "Only customers can access token balance" },
        { status: 403 },
      );
    }

    if (!user.activeCompanyId) {
      return NextResponse.json({ error: "User has no active company" }, { status: 400 });
    }

    const company = await prisma.company.findUnique({
      where: { id: user.activeCompanyId },
    });

    if (!company) {
      return NextResponse.json({ error: "Company not found for current user" }, { status: 404 });
    }

    const ledger = await prisma.tokenLedger.findMany({
      where: {
        companyId: company.id,
      },
      include: {
        ticket: {
          select: {
            id: true,
            companyTicketNumber: true,
            project: {
              select: {
                code: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50,
    });

    const entries = ledger.map((entry) => {
      const ticket = entry.ticket;
      const ticketCode = ticket
        ? buildTicketCode({
            projectCode: ticket.project?.code,
            companyTicketNumber: ticket.companyTicketNumber,
            ticketId: ticket.id,
          })
        : null;

      return {
        id: entry.id,
        createdAt: entry.createdAt.toISOString(),
        direction: entry.direction,
        amount: entry.amount,
        reason: entry.reason,
        notes: entry.notes,
        ticketCode,
        balanceBefore: entry.balanceBefore,
        balanceAfter: entry.balanceAfter,
      };
    });

    const totalCredits = ledger
      .filter((l) => l.direction === LedgerDirection.CREDIT)
      .reduce((sum, l) => sum + l.amount, 0);

    const totalDebits = ledger
      .filter((l) => l.direction === LedgerDirection.DEBIT)
      .reduce((sum, l) => sum + l.amount, 0);

    return NextResponse.json({
      company: {
        id: company.id,
        name: company.name,
        slug: company.slug,
        tokenBalance: company.tokenBalance,
      },
      stats: {
        totalCredits,
        totalDebits,
      },
      ledger: entries,
    });
  } catch (error: any) {
    if ((error as any)?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    console.error("[customer.tokens] GET error", error);
    return NextResponse.json({ error: "Failed to load customer tokens" }, { status: 500 });
  }
}
