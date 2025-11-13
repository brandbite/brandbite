// -----------------------------------------------------------------------------
// @file: app/api/admin/withdrawals/route.ts
// @purpose: Admin view for designer withdrawals with filters and pagination
// @version: v1.0.0
// @lastUpdate: 2025-11-13
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { WithdrawalStatus } from "@prisma/client";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

/**
 * Geçici tasarım:
 * - Auth kontrolü yok; BetterAuth sonrası sadece SiteOwner / SiteAdmin erişebilecek.
 *
 * Query param'lar:
 * - status (PENDING | APPROVED | REJECTED | PAID)
 * - designerId
 * - from (ISO date, createdAt >= from)
 * - to (ISO date, createdAt <= to)
 * - page, pageSize
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const statusParam = searchParams.get("status");
  const designerId = searchParams.get("designerId");

  let status: WithdrawalStatus | undefined;
  if (
    statusParam === "PENDING" ||
    statusParam === "APPROVED" ||
    statusParam === "REJECTED" ||
    statusParam === "PAID"
  ) {
    status = statusParam;
  }

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
    const where = {
      ...(status ? { status } : {}),
      ...(designerId ? { designerId } : {}),
      ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
    };

    const [totalCount, withdrawals] = await Promise.all([
      prisma.withdrawal.count({ where }),
      prisma.withdrawal.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        include: {
          designer: {
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
            },
          },
        },
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

    return NextResponse.json({
      filters: {
        status: status ?? null,
        designerId: designerId ?? null,
        from: createdAtFilter?.gte ?? null,
        to: createdAtFilter?.lte ?? null,
      },
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages,
      },
      withdrawals,
    });
  } catch (error) {
    console.error("[GET /api/admin/withdrawals] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
