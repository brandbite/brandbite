// -----------------------------------------------------------------------------
// @file: app/api/customer/tokens/route.ts
// @purpose: Customer token balance, all-time totals and filtered ledger page
// @version: v1.3.0
// @status: active
// @lastUpdate: 2026-11-05
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";

import {
  buildLedgerWhere,
  companyLedgerScope,
  LEDGER_INCLUDE,
  ledgerTicketCode,
  parseLedgerFilters,
  resolveCustomerCompany,
} from "@/lib/customer-token-ledger";
import { prisma } from "@/lib/prisma";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

function positiveInt(raw: string | null, fallback: number): number {
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

// -----------------------------------------------------------------------------
// GET: balance + all-time totals + one page of ledger entries.
// Optional params: direction, from (inclusive), to (exclusive), q, page, pageSize.
// Filters narrow the ledger only. stats always covers the whole ledger.
// -----------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    const resolved = await resolveCustomerCompany();
    if (!resolved.company) return resolved.response;
    const { company } = resolved;

    const params = new URL(req.url).searchParams;
    const parsed = parseLedgerFilters(params);
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const where = await buildLedgerWhere(companyLedgerScope(company.id), parsed.filters);
    const pageSize = Math.min(
      positiveInt(params.get("pageSize"), DEFAULT_PAGE_SIZE),
      MAX_PAGE_SIZE,
    );

    const [total, sums] = await Promise.all([
      prisma.tokenLedger.count({ where }),
      prisma.tokenLedger.groupBy({
        by: ["direction"],
        where: companyLedgerScope(company.id),
        _sum: { amount: true },
      }),
    ]);

    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(positiveInt(params.get("page"), 1), pageCount);

    const ledger = await prisma.tokenLedger.findMany({
      where,
      include: LEDGER_INCLUDE,
      // id breaks ties, so rows written in the same instant can't move between pages.
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const sumFor = (direction: "CREDIT" | "DEBIT") =>
      sums.find((s) => s.direction === direction)?._sum.amount ?? 0;

    return NextResponse.json({
      company: {
        id: company.id,
        name: company.name,
        slug: company.slug,
        tokenBalance: company.tokenBalance,
      },
      stats: {
        totalCredits: sumFor("CREDIT"),
        totalDebits: sumFor("DEBIT"),
      },
      ledger: ledger.map((entry) => ({
        id: entry.id,
        createdAt: entry.createdAt.toISOString(),
        direction: entry.direction,
        amount: entry.amount,
        reason: entry.reason,
        notes: entry.notes,
        ticketCode: ledgerTicketCode(entry),
        balanceBefore: entry.balanceBefore,
        balanceAfter: entry.balanceAfter,
      })),
      pagination: { page, pageSize, pageCount, total },
    });
  } catch (error: any) {
    if ((error as any)?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    console.error("[customer.tokens] GET error", error);
    return NextResponse.json({ error: "Failed to load customer tokens" }, { status: 500 });
  }
}
