// -----------------------------------------------------------------------------
// @file: app/api/designer/withdrawals/route.ts
// @purpose: Designer withdrawal requests (list and create)
// @version: v1.0.0
// @lastUpdate: 2025-11-13
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserTokenBalance } from "@/lib/token-engine";
import { WithdrawalStatus } from "@prisma/client";

const MIN_WITHDRAW_TOKENS = 20; // TODO: Configurable via admin panel
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

// GET /api/designer/withdrawals?userId=...
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json(
      { error: "Missing userId query parameter" },
      { status: 400 },
    );
  }

  const pageParam = searchParams.get("page") ?? "1";
  const pageSizeParam = searchParams.get("pageSize") ?? `${DEFAULT_PAGE_SIZE}`;

  const page = Math.max(1, Number(pageParam) || 1);
  const rawPageSize = Number(pageSizeParam) || DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(Math.max(rawPageSize, 1), MAX_PAGE_SIZE);
  const skip = (page - 1) * pageSize;

  try {
    const [user, balance, totalCount, withdrawals] = await Promise.all([
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
      prisma.withdrawal.count({
        where: { designerId: userId },
      }),
      prisma.withdrawal.findMany({
        where: { designerId: userId },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
    ]);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

    return NextResponse.json({
      user,
      balance,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages,
      },
      withdrawals,
    });
  } catch (error) {
    console.error("[GET /api/designer/withdrawals] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// POST /api/designer/withdrawals?userId=...
// Body: { "amountTokens": number, "notes"?: string }
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json(
      { error: "Missing userId query parameter" },
      { status: 400 },
    );
  }

  let body: { amountTokens?: number; notes?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const amountTokens = Number(body.amountTokens ?? 0);
  const notes = body.notes ?? null;

  if (!Number.isFinite(amountTokens) || amountTokens <= 0) {
    return NextResponse.json(
      { error: "amountTokens must be a positive number" },
      { status: 400 },
    );
  }

  if (amountTokens < MIN_WITHDRAW_TOKENS) {
    return NextResponse.json(
      {
        error: `Minimum withdrawal is ${MIN_WITHDRAW_TOKENS} tokens`,
        minWithdrawTokens: MIN_WITHDRAW_TOKENS,
      },
      { status: 400 },
    );
  }

  try {
    const [user, balance] = await Promise.all([
      prisma.userAccount.findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true },
      }),
      getUserTokenBalance(userId),
    ]);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (amountTokens > balance) {
      return NextResponse.json(
        {
          error: "Insufficient balance for withdrawal",
          availableBalance: balance,
          requestedAmount: amountTokens,
        },
        { status: 400 },
      );
    }

    const withdrawal = await prisma.withdrawal.create({
      data: {
        designerId: userId,
        amountTokens,
        status: WithdrawalStatus.PENDING,
        notes,
        metadata: {
          requestedBalanceAtTime: balance,
        },
      },
    });

    return NextResponse.json(
      {
        message: "Withdrawal request created",
        withdrawal,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[POST /api/designer/withdrawals] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
