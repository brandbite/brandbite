// -----------------------------------------------------------------------------
// @file: app/api/admin/withdrawals/[id]/reject/route.ts
// @purpose: Reject a designer withdrawal request
// @version: v1.0.0
// @lastUpdate: 2025-11-13
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma, WithdrawalStatus } from "@prisma/client";

/**
 * POST /api/admin/withdrawals/:id/reject
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  if (!id) {
    return NextResponse.json(
      { error: "Missing withdrawal id in route params" },
      { status: 400 }
    );
  }

  let body: { reason?: string };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const adminReason = body.reason ?? null;

  try {
    const withdrawal = await prisma.withdrawal.findUnique({
      where: { id },
    });

    if (!withdrawal) {
      return NextResponse.json(
        { error: "Withdrawal not found" },
        { status: 404 }
      );
    }

    if (withdrawal.status !== WithdrawalStatus.PENDING) {
      return NextResponse.json(
        {
          error: "Only PENDING withdrawals can be rejected",
          currentStatus: withdrawal.status,
        },
        { status: 400 }
      );
    }

    const updated = await prisma.withdrawal.update({
      where: { id },
      data: {
        status: WithdrawalStatus.REJECTED,
        metadata: {
          ...((typeof withdrawal.metadata === "object" && withdrawal.metadata !== null && !Array.isArray(withdrawal.metadata)) ? (withdrawal.metadata as Prisma.JsonObject) : {}),
          adminRejectReason: adminReason,
        },
      },
    });

    return NextResponse.json(
      {
        message: "Withdrawal rejected",
        withdrawal: updated,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[POST /api/admin/withdrawals/:id/reject] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
