// -----------------------------------------------------------------------------
// @file: app/api/creative/withdrawals/route.ts
// @purpose: Creative API for requesting and listing withdrawals
// @version: v1.1.0
// @status: active
// @lastUpdate: 2025-11-15
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { getUserTokenBalance } from "@/lib/token-engine";
import { getAppSettingInt } from "@/lib/app-settings";

const DEFAULT_MIN_WITHDRAWAL_TOKENS = 20;

// -----------------------------------------------------------------------------
// GET: list withdrawals for current creative + basic stats
// -----------------------------------------------------------------------------

export async function GET(_req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (user.role !== "DESIGNER") {
      return NextResponse.json(
        { error: "Only creatives can access their withdrawals" },
        { status: 403 },
      );
    }

    const [balance, withdrawals] = await Promise.all([
      getUserTokenBalance(user.id),
      prisma.withdrawal.findMany({
        where: { creativeId: user.id },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const totalRequested = withdrawals.reduce(
      (sum, w) => sum + w.amountTokens,
      0,
    );
    const pendingCount = withdrawals.filter(
      (w) => w.status === "PENDING",
    ).length;

    const items = withdrawals.map((w) => ({
      id: w.id,
      amountTokens: w.amountTokens,
      status: w.status,
      createdAt: w.createdAt.toISOString(),
      approvedAt: w.approvedAt ? w.approvedAt.toISOString() : null,
    }));

    return NextResponse.json({
      stats: {
        availableBalance: balance,
        totalRequested,
        pendingCount,
        withdrawalsCount: items.length,
      },
      withdrawals: items,
    });
  } catch (error: any) {
    if ((error as any)?.code === "UNAUTHENTICATED") {
      return NextResponse.json(
        { error: "Unauthenticated" },
        { status: 401 },
      );
    }

    console.error("[creative.withdrawals] GET error", error);
    return NextResponse.json(
      { error: "Failed to load creative withdrawals" },
      { status: 500 },
    );
  }
}

// -----------------------------------------------------------------------------
// POST: create a new withdrawal request for current creative
// -----------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (user.role !== "DESIGNER") {
      return NextResponse.json(
        { error: "Only creatives can create withdrawals" },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => null);
    const amountTokensRaw = body?.amountTokens;

    const amountTokens =
      typeof amountTokensRaw === "string"
        ? parseInt(amountTokensRaw, 10)
        : amountTokensRaw;

    if (
      typeof amountTokens !== "number" ||
      !Number.isFinite(amountTokens) ||
      amountTokens <= 0
    ) {
      return NextResponse.json(
        { error: "Invalid amountTokens value" },
        { status: 400 },
      );
    }

    const minWithdrawalTokens = await getAppSettingInt(
      "MIN_WITHDRAWAL_TOKENS",
      DEFAULT_MIN_WITHDRAWAL_TOKENS,
    );

    if (amountTokens < minWithdrawalTokens) {
      return NextResponse.json(
        {
          error: `Minimum withdrawal amount is ${minWithdrawalTokens} tokens.`,
        },
        { status: 400 },
      );
    }

    const balance = await getUserTokenBalance(user.id);

    if (amountTokens > balance) {
      return NextResponse.json(
        {
          error:
            "Requested amount exceeds your current token balance.",
        },
        { status: 400 },
      );
    }

    const withdrawal = await prisma.withdrawal.create({
      data: {
        creativeId: user.id,
        amountTokens,
        status: "PENDING",
      },
    });

    return NextResponse.json(
      {
        withdrawal: {
          id: withdrawal.id,
          amountTokens: withdrawal.amountTokens,
          status: withdrawal.status,
          createdAt: withdrawal.createdAt.toISOString(),
          approvedAt: withdrawal.approvedAt
            ? withdrawal.approvedAt.toISOString()
            : null,
        },
      },
      { status: 201 },
    );
  } catch (error: any) {
    if ((error as any)?.code === "UNAUTHENTICATED") {
      return NextResponse.json(
        { error: "Unauthenticated" },
        { status: 401 },
      );
    }

    console.error("[creative.withdrawals] POST error", error);
    return NextResponse.json(
      { error: "Failed to create withdrawal" },
      { status: 500 },
    );
  }
}
