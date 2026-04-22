// -----------------------------------------------------------------------------
// @file: app/api/admin/withdrawals/[id]/reject/route.ts
// @purpose: Reject a creative withdrawal request. Admin-level (SITE_OWNER or
//           SITE_ADMIN) — rejection is not a financial commitment so it's not
//           restricted to owners.
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AdminActionType, Prisma, WithdrawalStatus } from "@prisma/client";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { isSiteAdminRole } from "@/lib/roles";
import { extractAuditContext, logAdminAction } from "@/lib/admin-audit";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  if (!id) {
    return NextResponse.json({ error: "Missing withdrawal id in route params" }, { status: 400 });
  }

  let body: { reason?: string };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const adminReason = body.reason ?? null;

  try {
    const user = await getCurrentUserOrThrow();
    const auditCtx = extractAuditContext(request);

    if (!isSiteAdminRole(user.role)) {
      await logAdminAction({
        actor: user,
        action: AdminActionType.WITHDRAWAL_REJECT,
        outcome: "BLOCKED",
        targetType: "Withdrawal",
        targetId: id,
        errorMessage: "Only site admins can reject withdrawals.",
        context: auditCtx,
      });
      return NextResponse.json(
        { error: "Only site admins can reject withdrawals." },
        { status: 403 },
      );
    }

    const withdrawal = await prisma.withdrawal.findUnique({
      where: { id },
    });

    if (!withdrawal) {
      return NextResponse.json({ error: "Withdrawal not found" }, { status: 404 });
    }

    if (withdrawal.status !== WithdrawalStatus.PENDING) {
      return NextResponse.json(
        {
          error: "Only PENDING withdrawals can be rejected",
          currentStatus: withdrawal.status,
        },
        { status: 400 },
      );
    }

    const updated = await prisma.withdrawal.update({
      where: { id },
      data: {
        status: WithdrawalStatus.REJECTED,
        metadata: {
          ...(typeof withdrawal.metadata === "object" &&
          withdrawal.metadata !== null &&
          !Array.isArray(withdrawal.metadata)
            ? (withdrawal.metadata as Prisma.JsonObject)
            : {}),
          adminRejectReason: adminReason,
        },
      },
    });

    await logAdminAction({
      actor: user,
      action: AdminActionType.WITHDRAWAL_REJECT,
      outcome: "SUCCESS",
      targetType: "Withdrawal",
      targetId: updated.id,
      metadata: {
        amountTokens: updated.amountTokens,
        creativeId: updated.creativeId,
        reason: adminReason,
      },
      context: auditCtx,
    });

    return NextResponse.json(
      {
        message: "Withdrawal rejected",
        withdrawal: updated,
      },
      { status: 200 },
    );
  } catch (error) {
    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[POST /api/admin/withdrawals/:id/reject] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
