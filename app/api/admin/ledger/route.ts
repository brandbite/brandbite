// -----------------------------------------------------------------------------
// @file: app/api/admin/ledger/route.ts
// @purpose: Admin view for token ledger with filters, pagination and summary
// @version: v1.0.0
// @lastUpdate: 2025-11-13
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { LedgerDirection, Prisma } from "@prisma/client";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

/**
 * Geçici tasarım:
 * - Auth kontrolü yok; BetterAuth entegrasyonu sonrası sadece SiteOwner/SiteAdmin erişebilecek.
 *
 * Desteklenen query param'lar:
 * - companyId (opsiyonel)
 * - userId (opsiyonel)
 * - direction (opsiyonel, "CREDIT" veya "DEBIT")
 * - from (opsiyonel, ISO tarih – createdAt >= from)
 * - to (opsiyonel, ISO tarih – createdAt <= to)
 * - page (opsiyonel, varsayılan 1)
 * - pageSize (opsiyonel, varsayılan 50, max 200)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const companyId = searchParams.get("companyId");
  const userId = searchParams.get("userId");
  const directionParam = searchParams.get("direction");

  let direction: LedgerDirection | undefined;
  if (directionParam === "CREDIT" || directionParam === "DEBIT") {
    direction = directionParam;
  }

  // Pagination
  const pageParam = searchParams.get("page") ?? "1";
  const pageSizeParam = searchParams.get("pageSize") ?? `${DEFAULT_PAGE_SIZE}`;

  const page = Math.max(1, Number(pageParam) || 1);
  const rawPageSize = Number(pageSizeParam) || DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(Math.max(rawPageSize, 1), MAX_PAGE_SIZE);
  const skip = (page - 1) * pageSize;

  // Tarih filtreleri
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  let createdAtFilter: { gte?: Date; lte?: Date } | undefined;

  if (fromParam || toParam) {
    createdAtFilter = {};
    if (fromParam) {
      const fromDate = new Date(fromParam);
      if (!isNaN(fromDate.getTime())) {
        createdAtFilter.gte = fromDate;
      }
    }
    if (toParam) {
      const toDate = new Date(toParam);
      if (!isNaN(toDate.getTime())) {
        createdAtFilter.lte = toDate;
      }
    }
  }

  try {
    const where: Prisma.TokenLedgerWhereInput = {
      ...(companyId ? { companyId } : {}),
      ...(userId ? { userId } : {}),
      ...(direction ? { direction } : {}),
      ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
    };

    const [totalCount, ledger, creditAgg, debitAgg] = await Promise.all([
      prisma.tokenLedger.count({ where }),
      prisma.tokenLedger.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        select: {
          id: true,
          companyId: true,
          userId: true,
          ticketId: true,
          direction: true,
          amount: true,
          reason: true,
          notes: true,
          metadata: true,
          balanceBefore: true,
          balanceAfter: true,
          createdAt: true,
        },
      }),
      prisma.tokenLedger.aggregate({
        where: { ...where, direction: "CREDIT" },
        _sum: { amount: true },
      }),
      prisma.tokenLedger.aggregate({
        where: { ...where, direction: "DEBIT" },
        _sum: { amount: true },
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

    const totalCredit = creditAgg._sum.amount ?? 0;
    const totalDebit = debitAgg._sum.amount ?? 0;
    const net = totalCredit - totalDebit;

    return NextResponse.json({
      filters: {
        companyId: companyId ?? null,
        userId: userId ?? null,
        direction: direction ?? null,
        from: createdAtFilter?.gte ?? null,
        to: createdAtFilter?.lte ?? null,
      },
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages,
      },
      summary: {
        totalCredit,
        totalDebit,
        net,
      },
      ledger,
    });
  } catch (error) {
    console.error("[GET /api/admin/ledger] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
