// -----------------------------------------------------------------------------
// @file: app/api/admin/completed-jobs/route.ts
// @purpose: List completed (DONE) tickets for admin/site owner review
// @version: v1.0.0
// @status: active
// @lastUpdate: 2025-11-29
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { buildTicketCode } from "@/lib/ticket-code";

type CompletedJob = {
  ticketId: string;
  code: string;
  title: string;
  companyName: string | null;
  projectName: string | null;
  creativeName: string | null;
  creativeEmail: string | null;
  completedAt: string;
  jobTypeName: string | null;
  creativePayoutTokens: number | null;
  hasPayoutEntry: boolean;
  payoutLedgerCreatedAt: string | null;
};

type CompletedJobsResponse = {
  jobs: CompletedJob[];
};

export async function GET(_req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (user.role !== "SITE_OWNER" && user.role !== "SITE_ADMIN") {
      return NextResponse.json(
        { error: "Only site owners and site admins can access completed jobs." },
        { status: 403 },
      );
    }

    // Basit v1: tüm DONE ticket'lar (son güncellenenler önce)
    // İleride: date filter, company filter vs. eklenebilir.
    const tickets = await prisma.ticket.findMany({
      where: {
        status: "DONE",
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 100, // v1 için hard limit
      select: {
        id: true,
        title: true,
        status: true,
        companyTicketNumber: true,
        updatedAt: true,
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
        creative: {
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
            creativePayoutTokens: true,
          },
        },
        ledgerEntries: {
          where: {
            reason: "DESIGNER_JOB_PAYOUT",
          },
          select: {
            id: true,
            createdAt: true,
          },
        },
      },
    });

    const jobs: CompletedJob[] = tickets.map((t) => {
      const code = buildTicketCode({
        projectCode: t.project?.code,
        companyTicketNumber: t.companyTicketNumber,
        ticketId: t.id,
      });

      const hasPayoutEntry = (t.ledgerEntries?.length ?? 0) > 0;
      const payoutLedgerCreatedAt = hasPayoutEntry
        ? t.ledgerEntries[0].createdAt.toISOString()
        : null;

      return {
        ticketId: t.id,
        code,
        title: t.title,
        companyName: t.company?.name ?? null,
        projectName: t.project?.name ?? null,
        creativeName: t.creative?.name ?? null,
        creativeEmail: t.creative?.email ?? null,
        completedAt: t.updatedAt.toISOString(),
        jobTypeName: t.jobType?.name ?? null,
        creativePayoutTokens: t.jobType?.creativePayoutTokens ?? null,
        hasPayoutEntry,
        payoutLedgerCreatedAt,
      };
    });

    const response: CompletedJobsResponse = {
      jobs,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error: any) {
    if (error?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    console.error("[admin.completed-jobs] GET error", error);
    return NextResponse.json({ error: "Failed to load completed jobs" }, { status: 500 });
  }
}
