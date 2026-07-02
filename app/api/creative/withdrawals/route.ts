// -----------------------------------------------------------------------------
// @file: app/api/creative/withdrawals/route.ts
// @purpose: Creative API for requesting and listing withdrawals
// @version: v1.1.0
// @status: active
// @lastUpdate: 2025-11-15
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifySiteOwnersOfEvent } from "@/lib/admin-event-email";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { getUserTokenBalance } from "@/lib/token-engine";
import { getCreativeWithdrawableBalance } from "@/lib/withdrawals";
import { getAppSettingInt } from "@/lib/app-settings";
import { parseBody } from "@/lib/schemas/helpers";
import { createWithdrawalSchema } from "@/lib/schemas/withdrawal.schemas";

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

    const [balance, withdrawals, minWithdrawalTokens] = await Promise.all([
      getUserTokenBalance(user.id),
      prisma.withdrawal.findMany({
        where: { creativeId: user.id },
        orderBy: { createdAt: "desc" },
      }),
      getAppSettingInt("MIN_WITHDRAWAL_TOKENS", DEFAULT_MIN_WITHDRAWAL_TOKENS),
    ]);

    const totalRequested = withdrawals.reduce((sum, w) => sum + w.amountTokens, 0);
    const pendingCount = withdrawals.filter((w) => w.status === "PENDING").length;

    // Tokens committed to open (not-yet-paid) withdrawals. These haven't
    // debited the ledger, so the spendable balance is the raw balance minus
    // this reservation — that's the real cap for a new request.
    const reservedTokens = withdrawals
      .filter((w) => w.status === "PENDING" || w.status === "APPROVED")
      .reduce((sum, w) => sum + w.amountTokens, 0);
    const spendableBalance = balance - reservedTokens;

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
        reservedTokens,
        spendableBalance,
        totalRequested,
        pendingCount,
        withdrawalsCount: items.length,
        minWithdrawalTokens,
      },
      withdrawals: items,
    });
  } catch (error: any) {
    if ((error as any)?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    console.error("[creative.withdrawals] GET error", error);
    return NextResponse.json({ error: "Failed to load creative withdrawals" }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// POST: create a new withdrawal request for current creative
// -----------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (user.role !== "DESIGNER") {
      return NextResponse.json({ error: "Only creatives can create withdrawals" }, { status: 403 });
    }

    const parsed = await parseBody(req, createWithdrawalSchema);
    if (!parsed.success) return parsed.response;
    const { amountTokens } = parsed.data;

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

    // Available = balance minus tokens committed to open (PENDING/APPROVED)
    // withdrawals — see getCreativeWithdrawableBalance. Checking the raw
    // balance alone would let a creative stack requests that together exceed it.
    const { reserved, available } = await getCreativeWithdrawableBalance(user.id);

    if (amountTokens > available) {
      return NextResponse.json(
        {
          error:
            reserved > 0
              ? "Requested amount exceeds your available balance after pending withdrawals."
              : "Requested amount exceeds your current token balance.",
          availableBalance: available,
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

    // Best-effort SITE_OWNER notification — "$creative requested a payout".
    // Fire-and-forget so the creative's response isn't blocked on Resend.
    void notifySiteOwnersOfEvent({
      kind: "NEW_WITHDRAWAL_REQUEST",
      withdrawalId: withdrawal.id,
      creativeEmail: user.email,
      amountTokens: withdrawal.amountTokens,
    });

    return NextResponse.json(
      {
        withdrawal: {
          id: withdrawal.id,
          amountTokens: withdrawal.amountTokens,
          status: withdrawal.status,
          createdAt: withdrawal.createdAt.toISOString(),
          approvedAt: withdrawal.approvedAt ? withdrawal.approvedAt.toISOString() : null,
        },
      },
      { status: 201 },
    );
  } catch (error: any) {
    if ((error as any)?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    console.error("[creative.withdrawals] POST error", error);
    return NextResponse.json({ error: "Failed to create withdrawal" }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// DELETE: cancel a PENDING withdrawal request
// -----------------------------------------------------------------------------

export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (user.role !== "DESIGNER") {
      return NextResponse.json({ error: "Only creatives can cancel withdrawals" }, { status: 403 });
    }

    const { id } = await req.json();
    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Missing withdrawal id" }, { status: 400 });
    }

    const withdrawal = await prisma.withdrawal.findUnique({
      where: { id },
    });

    if (!withdrawal || withdrawal.creativeId !== user.id) {
      return NextResponse.json({ error: "Withdrawal not found" }, { status: 404 });
    }

    if (withdrawal.status !== "PENDING") {
      return NextResponse.json(
        { error: "Only pending withdrawals can be cancelled" },
        { status: 400 },
      );
    }

    await prisma.withdrawal.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if ((error as any)?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    console.error("[creative.withdrawals] DELETE error", error);
    return NextResponse.json({ error: "Failed to cancel withdrawal" }, { status: 500 });
  }
}
