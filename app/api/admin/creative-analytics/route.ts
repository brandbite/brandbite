// -----------------------------------------------------------------------------
// @file: app/api/admin/creative-analytics/route.ts
// @purpose: Creative performance analytics — per-creative metrics for admin
// @version: v1.0.0
// @status: active
// @lastUpdate: 2025-12-15
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { TicketPriority } from "@prisma/client";

function requireAdmin(userRole: string) {
  if (userRole !== "SITE_OWNER" && userRole !== "SITE_ADMIN") {
    const error: Error & { code?: string; status?: number } = new Error(
      "You do not have permission to view creative analytics.",
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

    // -----------------------------------------------------------------------
    // Run all queries in parallel
    // -----------------------------------------------------------------------

    const [creatives, tickets, revisions, earningsGrouped, withdrawalsGrouped] =
      await Promise.all([
        // 1. All creatives
        prisma.userAccount.findMany({
          where: { role: "DESIGNER" },
          select: { id: true, name: true, email: true },
        }),

        // 2. All tickets with a creative assigned
        prisma.ticket.findMany({
          where: { creativeId: { not: null } },
          select: {
            id: true,
            creativeId: true,
            status: true,
            priority: true,
            revisionCount: true,
            createdAt: true,
            updatedAt: true,
            jobType: { select: { tokenCost: true } },
          },
        }),

        // 3. All revisions submitted by creatives
        prisma.ticketRevision.findMany({
          where: { submittedByCreativeId: { not: null } },
          select: {
            submittedByCreativeId: true,
            submittedAt: true,
            feedbackAt: true,
            version: true,
            ticketId: true,
          },
        }),

        // 4. Earnings grouped by creative
        prisma.tokenLedger.groupBy({
          by: ["userId"],
          where: { direction: "CREDIT", userId: { not: null } },
          _sum: { amount: true },
          _count: true,
        }),

        // 5. Withdrawals grouped by creative
        prisma.withdrawal.groupBy({
          by: ["creativeId"],
          _sum: { amountTokens: true },
          _count: true,
        }),
      ]);

    // -----------------------------------------------------------------------
    // Build lookup maps
    // -----------------------------------------------------------------------

    const earningsMap = new Map<string, { total: number; count: number }>();
    for (const row of earningsGrouped) {
      if (row.userId) {
        earningsMap.set(row.userId, {
          total: row._sum.amount ?? 0,
          count: row._count,
        });
      }
    }

    const withdrawalsMap = new Map<string, { total: number; count: number }>();
    for (const row of withdrawalsGrouped) {
      withdrawalsMap.set(row.creativeId, {
        total: row._sum.amountTokens ?? 0,
        count: row._count,
      });
    }

    // -----------------------------------------------------------------------
    // Load score weights (same formula as creative tickets API)
    // -----------------------------------------------------------------------

    const priorityWeights: Record<TicketPriority, number> = {
      LOW: 1,
      MEDIUM: 2,
      HIGH: 3,
      URGENT: 4,
    };

    // -----------------------------------------------------------------------
    // Compute per-creative metrics
    // -----------------------------------------------------------------------

    let platformTotalCompleted = 0;
    let platformRevisionSum = 0;
    let platformRevisionTicketCount = 0;
    let platformTurnaroundSum = 0;
    let platformTurnaroundCount = 0;

    const creativeMetrics = creatives.map((d) => {
      // Tickets
      const dTickets = tickets.filter((t) => t.creativeId === d.id);
      const completedTickets = dTickets.filter(
        (t) => t.status === "DONE",
      ).length;
      const activeTickets = dTickets.filter(
        (t) => t.status !== "DONE",
      ).length;
      const totalTickets = dTickets.length;
      const completionRate =
        totalTickets > 0
          ? Math.round((completedTickets / totalTickets) * 100)
          : 0;

      // Average revision count (from completed tickets)
      const completedWithRevisions = dTickets.filter(
        (t) => t.status === "DONE",
      );
      const revisionSum = completedWithRevisions.reduce(
        (sum, t) => sum + t.revisionCount,
        0,
      );
      const avgRevisionCount =
        completedWithRevisions.length > 0
          ? Math.round((revisionSum / completedWithRevisions.length) * 10) / 10
          : 0;

      // Average turnaround (hours) — from revision submittedAt to feedbackAt
      const dRevisions = revisions.filter(
        (r) => r.submittedByCreativeId === d.id && r.feedbackAt,
      );
      let turnaroundSum = 0;
      let turnaroundCount = 0;
      for (const r of dRevisions) {
        if (r.feedbackAt && r.submittedAt) {
          const hours =
            (new Date(r.feedbackAt).getTime() -
              new Date(r.submittedAt).getTime()) /
            (1000 * 60 * 60);
          if (hours >= 0) {
            turnaroundSum += hours;
            turnaroundCount += 1;
          }
        }
      }
      const avgTurnaroundHours =
        turnaroundCount > 0
          ? Math.round((turnaroundSum / turnaroundCount) * 10) / 10
          : 0;

      // Load score (priority-weighted, non-DONE tickets only)
      let loadScore = 0;
      for (const t of dTickets) {
        if (t.status !== "DONE") {
          const weight = priorityWeights[t.priority as TicketPriority] ?? 2;
          const tokenCost = t.jobType?.tokenCost ?? 1;
          loadScore += weight * tokenCost;
        }
      }

      // Earnings & withdrawals
      const earnings = earningsMap.get(d.id);
      const withdrawals = withdrawalsMap.get(d.id);

      // Platform aggregation
      platformTotalCompleted += completedTickets;
      platformRevisionSum += revisionSum;
      platformRevisionTicketCount += completedWithRevisions.length;
      platformTurnaroundSum += turnaroundSum;
      platformTurnaroundCount += turnaroundCount;

      return {
        id: d.id,
        name: d.name,
        email: d.email,
        completedTickets,
        activeTickets,
        totalTickets,
        completionRate,
        avgRevisionCount,
        avgTurnaroundHours,
        loadScore,
        totalEarnings: earnings?.total ?? 0,
        totalWithdrawn: withdrawals?.total ?? 0,
      };
    });

    // Sort by completed tickets descending
    creativeMetrics.sort((a, b) => b.completedTickets - a.completedTickets);

    // -----------------------------------------------------------------------
    // Platform summary
    // -----------------------------------------------------------------------

    const avgPlatformRevisionRate =
      platformRevisionTicketCount > 0
        ? Math.round(
            (platformRevisionSum / platformRevisionTicketCount) * 10,
          ) / 10
        : 0;

    const avgPlatformTurnaround =
      platformTurnaroundCount > 0
        ? Math.round((platformTurnaroundSum / platformTurnaroundCount) * 10) /
          10
        : 0;

    return NextResponse.json({
      summary: {
        totalCreatives: creatives.length,
        totalCompletedTickets: platformTotalCompleted,
        avgPlatformRevisionRate,
        avgPlatformTurnaround,
      },
      creatives: creativeMetrics,
    });
  } catch (err: any) {
    console.error("[CreativeAnalytics] GET error:", err);

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
      { error: "Failed to load creative analytics." },
      { status: 500 },
    );
  }
}
