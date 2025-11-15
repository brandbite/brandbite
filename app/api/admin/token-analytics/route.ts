// -----------------------------------------------------------------------------
// @file: app/api/admin/token-analytics/route.ts
// @purpose: Admin API for aggregated token analytics per company
// @version: v1.0.0
// @status: active
// @lastUpdate: 2025-11-15
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { LedgerDirection } from "@prisma/client";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { isSiteAdminRole } from "@/lib/roles";

export async function GET(_req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json(
        { error: "Only site admins can access token analytics" },
        { status: 403 },
      );
    }

    const [ledger, companies] = await Promise.all([
      prisma.tokenLedger.findMany({
        where: {
          companyId: {
            not: null,
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      }),
      prisma.company.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
        },
      }),
    ]);

    const companyInfo = new Map<
      string,
      { id: string; name: string; slug: string }
    >();
    for (const c of companies) {
      companyInfo.set(c.id, { id: c.id, name: c.name, slug: c.slug });
    }

    type CompanyAgg = {
      companyId: string;
      totalCredits: number;
      totalDebits: number;
      netTokens: number;
      entriesCount: number;
    };

    const perCompany = new Map<string, CompanyAgg>();

    let globalCredits = 0;
    let globalDebits = 0;

    for (const entry of ledger) {
      if (!entry.companyId) continue;

      const isCredit = entry.direction === LedgerDirection.CREDIT;
      const delta = entry.amount;

      if (isCredit) {
        globalCredits += delta;
      } else {
        globalDebits += delta;
      }

      const existing =
        perCompany.get(entry.companyId) ?? {
          companyId: entry.companyId,
          totalCredits: 0,
          totalDebits: 0,
          netTokens: 0,
          entriesCount: 0,
        };

      if (isCredit) {
        existing.totalCredits += delta;
      } else {
        existing.totalDebits += delta;
      }

      existing.netTokens = existing.totalCredits - existing.totalDebits;
      existing.entriesCount += 1;

      perCompany.set(entry.companyId, existing);
    }

    const perCompanyArray = Array.from(perCompany.values()).map(
      (agg) => {
        const meta = companyInfo.get(agg.companyId);
        return {
          companyId: agg.companyId,
          company: meta
            ? {
                id: meta.id,
                name: meta.name,
                slug: meta.slug,
              }
            : null,
          totalCredits: agg.totalCredits,
          totalDebits: agg.totalDebits,
          netTokens: agg.netTokens,
          entriesCount: agg.entriesCount,
        };
      },
    );

    perCompanyArray.sort(
      (a, b) => (b.netTokens ?? 0) - (a.netTokens ?? 0),
    );

    return NextResponse.json({
      stats: {
        globalCredits,
        globalDebits,
        globalNet: globalCredits - globalDebits,
        companiesWithLedger: perCompanyArray.length,
        ledgerEntriesCount: ledger.length,
      },
      perCompany: perCompanyArray,
    });
  } catch (error: any) {
    if ((error as any)?.code === "UNAUTHENTICATED") {
      return NextResponse.json(
        { error: "Unauthenticated" },
        { status: 401 },
      );
    }

    console.error("[admin.token-analytics] GET error", error);
    return NextResponse.json(
      { error: "Failed to load token analytics" },
      { status: 500 },
    );
  }
}
