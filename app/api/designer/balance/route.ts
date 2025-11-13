// -----------------------------------------------------------------------------
// @file: app/api/designer/balance/route.ts
// @purpose: Returns designer token balance and recent ledger entries
// @version: v1.0.0
// @lastUpdate: 2025-11-13
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserTokenBalance } from "@/lib/token-engine";

const MAX_ENTRIES = 50;

/**
 * Geçici tasarım:
 * - userId şimdilik query param üzerinden geliyor: /api/designer/balance?userId=...
 * - BetterAuth entegre olduktan sonra userId'yi session'dan alacağız.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json(
      { error: "Missing userId query parameter" },
      { status: 400 }
    );
  }

  try {
    const [user, balance, ledger] = await Promise.all([
      prisma.userAccount.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
        },
      }),
      getUserTokenBalance(userId),
      prisma.tokenLedger.findMany({
        where: { userId },
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
          companyId: true,
        },
      }),
    ]);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      user,
      balance,
      ledger,
    });
  } catch (error) {
    console.error("[GET /api/designer/balance] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}