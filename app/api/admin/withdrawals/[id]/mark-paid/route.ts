// -----------------------------------------------------------------------------
// @file: app/api/admin/withdrawals/[id]/mark-paid/route.ts
// @purpose: Mark an approved withdrawal as paid. SITE_OWNER only — this
//           records that actual money left the platform, so it ranks with
//           APPROVE in terms of financial consequence.
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AdminActionType, WithdrawalStatus } from "@prisma/client";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { canMarkWithdrawalsPaid } from "@/lib/roles";
import { extractAuditContext, logAdminAction } from "@/lib/admin-audit";
import { CONFIRMATION_PHRASES, checkConfirmationPhrase } from "@/lib/admin-confirmation";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  if (!id) {
    return NextResponse.json({ error: "Missing withdrawal id in route params" }, { status: 400 });
  }

  try {
    const user = await getCurrentUserOrThrow();
    const auditCtx = extractAuditContext(request);

    if (!canMarkWithdrawalsPaid(user.role)) {
      await logAdminAction({
        actor: user,
        action: AdminActionType.WITHDRAWAL_MARK_PAID,
        outcome: "BLOCKED",
        targetType: "Withdrawal",
        targetId: id,
        errorMessage: "Only site owners can mark withdrawals as paid.",
        context: auditCtx,
      });
      return NextResponse.json(
        { error: "Only site owners can mark withdrawals as paid." },
        { status: 403 },
      );
    }

    const body = (await request.json().catch(() => null)) as {
      confirmation?: string;
    } | null;

    const phraseCheck = checkConfirmationPhrase(
      body?.confirmation,
      CONFIRMATION_PHRASES.WITHDRAWAL_MARK_PAID,
    );
    if (!phraseCheck.ok) {
      await logAdminAction({
        actor: user,
        action: AdminActionType.WITHDRAWAL_MARK_PAID,
        outcome: "BLOCKED",
        targetType: "Withdrawal",
        targetId: id,
        errorMessage: phraseCheck.error,
        context: auditCtx,
      });
      return NextResponse.json({ error: phraseCheck.error }, { status: 400 });
    }

    const withdrawal = await prisma.withdrawal.findUnique({
      where: { id },
    });

    if (!withdrawal) {
      return NextResponse.json({ error: "Withdrawal not found" }, { status: 404 });
    }

    if (withdrawal.status !== WithdrawalStatus.APPROVED) {
      return NextResponse.json(
        {
          error: "Only APPROVED withdrawals can be marked as PAID",
          currentStatus: withdrawal.status,
        },
        { status: 400 },
      );
    }

    const updated = await prisma.withdrawal.update({
      where: { id },
      data: {
        status: WithdrawalStatus.PAID,
        paidAt: new Date(),
      },
    });

    await logAdminAction({
      actor: user,
      action: AdminActionType.WITHDRAWAL_MARK_PAID,
      outcome: "SUCCESS",
      targetType: "Withdrawal",
      targetId: updated.id,
      metadata: {
        amountTokens: updated.amountTokens,
        creativeId: updated.creativeId,
      },
      context: auditCtx,
    });

    return NextResponse.json(
      {
        message: "Withdrawal marked as paid",
        withdrawal: updated,
      },
      { status: 200 },
    );
  } catch (error) {
    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[POST /api/admin/withdrawals/:id/mark-paid] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
