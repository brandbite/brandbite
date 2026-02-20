// -----------------------------------------------------------------------------
// @file: app/api/admin/dashboard/route.ts
// @purpose: Admin dashboard analytics — platform-wide metrics aggregation
// @version: v1.0.0
// @status: active
// @lastUpdate: 2025-11-25
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";

function requireAdmin(userRole: string) {
  if (userRole !== "SITE_OWNER" && userRole !== "SITE_ADMIN") {
    const error: Error & { code?: string; status?: number } = new Error(
      "You do not have permission to view the admin dashboard.",
    );
    error.code = "FORBIDDEN";
    error.status = 403;
    throw error;
  }
}

export async function GET() {
  try {
    const user = await getCurrentUserOrThrow();
    requireAdmin(user.role);

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Run all queries in parallel for maximum performance
    const [
      totalCompanies,
      totalCreatives,
      totalTickets,
      ticketsByStatus,
      ticketsByPriority,
      ticketsCreatedLast30Days,
      ticketsCompletedLast30Days,
      avgRevisionData,
      activeCompanies,
      tokenStats,
      totalCompanyBalances,
      pendingWithdrawals,
      totalPaidWithdrawals,
      companiesLowBalance,
      overdueTickets,
      staleTickets,
    ] = await Promise.all([
      // Total companies
      prisma.company.count(),

      // Total creatives
      prisma.userAccount.count({
        where: { role: "DESIGNER" },
      }),

      // Total tickets
      prisma.ticket.count(),

      // Tickets by status
      prisma.ticket.groupBy({
        by: ["status"],
        _count: { id: true },
      }),

      // Tickets by priority
      prisma.ticket.groupBy({
        by: ["priority"],
        _count: { id: true },
      }),

      // Tickets created in last 30 days
      prisma.ticket.count({
        where: { createdAt: { gte: thirtyDaysAgo } },
      }),

      // Tickets completed (moved to DONE) in last 30 days
      prisma.ticket.count({
        where: {
          status: "DONE",
          updatedAt: { gte: thirtyDaysAgo },
        },
      }),

      // Average revision count for completed tickets
      prisma.ticket.aggregate({
        where: { status: "DONE" },
        _avg: { revisionCount: true },
      }),

      // Active companies (have tickets created in last 30 days)
      prisma.company.count({
        where: {
          tickets: {
            some: { createdAt: { gte: thirtyDaysAgo } },
          },
        },
      }),

      // Token stats — global credits & debits
      prisma.tokenLedger.groupBy({
        by: ["direction"],
        _sum: { amount: true },
      }),

      // Sum of all company token balances
      prisma.company.aggregate({
        _sum: { tokenBalance: true },
      }),

      // Pending withdrawals
      prisma.withdrawal.aggregate({
        where: { status: "PENDING" },
        _count: { id: true },
        _sum: { amountTokens: true },
      }),

      // Total paid withdrawals
      prisma.withdrawal.aggregate({
        where: { status: "PAID" },
        _sum: { amountTokens: true },
      }),

      // Companies with low balance (< 5 tokens)
      prisma.company.count({
        where: { tokenBalance: { lt: 5 } },
      }),

      // Overdue tickets (past due date and not DONE)
      prisma.ticket.count({
        where: {
          status: { not: "DONE" },
          dueDate: { lt: now },
        },
      }),

      // Stale tickets (IN_PROGRESS for > 7 days without update)
      prisma.ticket.count({
        where: {
          status: "IN_PROGRESS",
          updatedAt: { lt: sevenDaysAgo },
        },
      }),
    ]);

    // Process token stats
    const creditRow = tokenStats.find((r: any) => r.direction === "CREDIT");
    const debitRow = tokenStats.find((r: any) => r.direction === "DEBIT");
    const globalCredits = creditRow?._sum.amount ?? 0;
    const globalDebits = debitRow?._sum.amount ?? 0;

    // Build status map
    const statusMap: Record<string, number> = {
      TODO: 0,
      IN_PROGRESS: 0,
      IN_REVIEW: 0,
      DONE: 0,
    };
    for (const row of ticketsByStatus) {
      statusMap[row.status] = row._count.id;
    }

    // Build priority map
    const priorityMap: Record<string, number> = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      URGENT: 0,
    };
    for (const row of ticketsByPriority) {
      priorityMap[row.priority] = row._count.id;
    }

    return NextResponse.json({
      platform: {
        totalCompanies,
        activeCompanies,
        totalCreatives,
        totalTickets,
        ticketsByStatus: statusMap,
        ticketsByPriority: priorityMap,
        ticketsCreatedLast30Days,
        ticketsCompletedLast30Days,
        avgRevisionCount: Math.round((avgRevisionData._avg.revisionCount ?? 0) * 10) / 10,
      },
      tokens: {
        globalCredits,
        globalDebits,
        globalNet: globalCredits - globalDebits,
        totalCompanyBalances: totalCompanyBalances._sum.tokenBalance ?? 0,
      },
      withdrawals: {
        pendingCount: pendingWithdrawals._count.id,
        pendingAmount: pendingWithdrawals._sum.amountTokens ?? 0,
        totalPaid: totalPaidWithdrawals._sum.amountTokens ?? 0,
      },
      health: {
        companiesLowBalance,
        overdueTickets,
        staleTickets,
      },
    });
  } catch (err: any) {
    console.error("[AdminDashboard] GET error:", err);

    if (err?.code === "UNAUTHENTICATED") {
      return NextResponse.json(
        { error: err.message ?? "Not authenticated." },
        { status: 401 },
      );
    }
    if (err?.code === "FORBIDDEN") {
      return NextResponse.json(
        { error: err.message ?? "Access denied." },
        { status: 403 },
      );
    }

    return NextResponse.json(
      { error: "Failed to load admin dashboard data." },
      { status: 500 },
    );
  }
}
