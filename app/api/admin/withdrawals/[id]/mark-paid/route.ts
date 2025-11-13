// -----------------------------------------------------------------------------
// @file: app/api/admin/withdrawals/[id]/mark-paid/route.ts
// @purpose: Mark an approved withdrawal as paid
// @version: v1.0.0
// @lastUpdate: 2025-11-13
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { WithdrawalStatus } from "@prisma/client";

/**
 * POST /api/admin/withdrawals/:id/mark-paid
 */
export async function POST(
  _request: Request,
  context: { params: { id: string } }
) {
  const id = context.params.id;

  if (!id) {
    return NextResponse.json(
      { error: "Missing withdrawal id in route params" },
      { status: 400 }
    );
  }

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

    if (withdrawal.status !== WithdrawalStatus.APPROVED) {
      return NextResponse.json(
        {
          error: "Only APPROVED withdrawals can be marked as PAID",
          currentStatus: withdrawal.status,
        },
        { status: 400 }
      );
    }

    const updated = await prisma.withdrawal.update({
      where: { id },
      data: {
        status: WithdrawalStatus.PAID,
        paidAt: new Date(),
      },
    });

    return NextResponse.json(
      {
        message: "Withdrawal marked as paid",
        withdrawal: updated,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[POST /api/admin/withdrawals/:id/mark-paid] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
