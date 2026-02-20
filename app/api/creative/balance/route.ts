// -----------------------------------------------------------------------------
// @file: app/api/creative/balance/route.ts
// @purpose: Returns creative token balance and recent ledger entries
// @version: v1.1.0
// @lastUpdate: 2025-11-15
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserTokenBalance } from "@/lib/token-engine";
import { getCurrentUserOrThrow } from "@/lib/auth";

const MAX_ENTRIES = 50;

/**
 * Tasarım (v1.1.0):
 * - userId artık query param üzerinden gelmiyor.
 * - Aktif creative, demo auth (bb-demo-user) + gelecekte BetterAuth üzerinden
 *   getCurrentUserOrThrow() ile belirleniyor.
 * - Sadece role === DESIGNER olan kullanıcılar bu endpoint'e erişebiliyor.
 */
export async function GET(_request: Request) {
  try {
    const currentUser = await getCurrentUserOrThrow();

    if (currentUser.role !== "DESIGNER") {
      return NextResponse.json(
        { error: "Only creatives can access creative balance" },
        { status: 403 },
      );
    }

    const userId = currentUser.id;

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
  } catch (error: any) {
    if ((error as any)?.code === "UNAUTHENTICATED") {
      return NextResponse.json(
        { error: "Unauthenticated" },
        { status: 401 },
      );
    }

    console.error("[GET /api/creative/balance] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
