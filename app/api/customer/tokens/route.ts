// -----------------------------------------------------------------------------
// @file: app/api/customer/tokens/route.ts
// @purpose: Returns company token balance and recent ledger entries for customer
// @version: v1.0.0
// @lastUpdate: 2025-11-13
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const MAX_ENTRIES = 50;

/**
 * Geçici tasarım:
 * - companyId şimdilik query param üzerinden geliyor: /api/customer/tokens?companyId=...
 * - BetterAuth entegre olduktan sonra companyId'yi session / user context'ten alacağız.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId");

  if (!companyId) {
    return NextResponse.json(
      { error: "Missing companyId query parameter" },
      { status: 400 }
    );
  }

  try {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        slug: true,
        tokenBalance: true,
      },
    });

    if (!company) {
      return NextResponse.json(
        { error: "Company not found" },
        { status: 404 }
      );
    }

    const ledger = await prisma.tokenLedger.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: MAX_ENTRIES,
      select: {
        id: true,
        direction: true,
        amount: true,
        reason: true,
        notes: true,
        metadata: true,
        balanceBefore: true,
        balanceAfter: true,
        createdAt: true,
        ticketId: true,
      },
    });

    return NextResponse.json({
      company,
      ledger,
    });
  } catch (error) {
    console.error("[GET /api/customer/tokens] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}