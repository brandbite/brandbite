// -----------------------------------------------------------------------------
// @file: app/api/admin/ledger/route.ts
// @purpose: Admin view over global token ledger (all companies & users)
// @version: v1.1.0
// @status: active
// @lastUpdate: 2025-11-15
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { LedgerDirection } from "@prisma/client";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { isSiteAdminRole } from "@/lib/roles";

/**
 * Admin ledger endpoint
 *
 * - Only SITE_OWNER / SITE_ADMIN can access.
 * - Returns recent TokenLedger entries across all companies.
 * - Includes basic joins to company, ticket, project and user.
 */
export async function GET(_req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json(
        { error: "Only site admins can access the admin ledger" },
        { status: 403 },
      );
    }

    const ledger = await prisma.tokenLedger.findMany({
      include: {
        company: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        ticket: {
          select: {
            id: true,
            title: true,
            companyTicketNumber: true,
            project: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 200,
    });

    const entries = ledger.map((entry) => {
      const ticket = entry.ticket;
      const project = ticket?.project;
      const company = entry.company;
      const actor = entry.user;

      const ticketCode =
        project?.code && ticket?.companyTicketNumber != null
          ? `${project.code}-${ticket.companyTicketNumber}`
          : ticket?.companyTicketNumber != null
          ? `#${ticket.companyTicketNumber}`
          : ticket?.id ?? null;

      const directionLabel =
        entry.direction === LedgerDirection.CREDIT ? "CREDIT" : "DEBIT";

      return {
        id: entry.id,
        createdAt: entry.createdAt.toISOString(),
        direction: directionLabel,
        amount: entry.amount,
        reason: entry.reason,
        notes: entry.notes,
        company: company
          ? {
              id: company.id,
              name: company.name,
              slug: company.slug,
            }
          : null,
        ticket: ticket
          ? {
              id: ticket.id,
              title: ticket.title,
              code: ticketCode,
              projectName: project?.name ?? null,
              projectCode: project?.code ?? null,
            }
          : null,
        user: actor
          ? {
              id: actor.id,
              email: actor.email,
              name: actor.name,
              role: actor.role,
            }
          : null,
        balanceBefore: entry.balanceBefore,
        balanceAfter: entry.balanceAfter,
        metadata: entry.metadata,
      };
    });

    const totalCredits = ledger
      .filter((e) => e.direction === LedgerDirection.CREDIT)
      .reduce((sum, e) => sum + e.amount, 0);

    const totalDebits = ledger
      .filter((e) => e.direction === LedgerDirection.DEBIT)
      .reduce((sum, e) => sum + e.amount, 0);

    return NextResponse.json({
      stats: {
        totalCredits,
        totalDebits,
        netTokens: totalCredits - totalDebits,
        entriesCount: entries.length,
      },
      entries,
    });
  } catch (error: any) {
    if ((error as any)?.code === "UNAUTHENTICATED") {
      return NextResponse.json(
        { error: "Unauthenticated" },
        { status: 401 },
      );
    }

    console.error("[admin.ledger] GET error", error);
    return NextResponse.json(
      { error: "Failed to load admin ledger" },
      { status: 500 },
    );
  }
}
