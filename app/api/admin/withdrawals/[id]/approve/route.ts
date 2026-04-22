// -----------------------------------------------------------------------------
// @file: app/api/admin/withdrawals/[id]/approve/route.ts
// @purpose: Approve a creative withdrawal and apply token debit
// @version: v1.0.0
// @lastUpdate: 2025-11-13
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AdminActionType, Prisma, WithdrawalStatus } from "@prisma/client";
import { applyUserLedgerEntry, getUserTokenBalance } from "@/lib/token-engine";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { canApproveWithdrawals } from "@/lib/roles";
import { extractAuditContext, logAdminAction } from "@/lib/admin-audit";
import { CONFIRMATION_PHRASES, checkConfirmationPhrase } from "@/lib/admin-confirmation";
import { MFA_ACTION_TAG_MONEY, requireFreshMfa } from "@/lib/mfa";
import {
  evaluateCoApproval,
  hasAlreadyApproved,
  recordApproval,
  requiresCoApproval,
} from "@/lib/withdrawal-coapproval";
import { sendCoApprovalRequest } from "@/lib/admin-action-email";

/**
 * POST /api/admin/withdrawals/:id/approve
 *
 * SITE_OWNER only — approving a withdrawal commits the platform to paying
 * the creative. The sibling PATCH /api/admin/withdrawals route enforces the
 * same policy via canApproveWithdrawals.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  if (!id) {
    return NextResponse.json({ error: "Missing withdrawal id in route params" }, { status: 400 });
  }

  try {
    const user = await getCurrentUserOrThrow();
    const auditCtx = extractAuditContext(request);
    if (!canApproveWithdrawals(user.role)) {
      await logAdminAction({
        actor: user,
        action: AdminActionType.WITHDRAWAL_APPROVE,
        outcome: "BLOCKED",
        targetType: "Withdrawal",
        targetId: id,
        errorMessage: "Only site owners can approve withdrawals.",
        context: auditCtx,
      });
      return NextResponse.json(
        { error: "Only site owners can approve withdrawals." },
        { status: 403 },
      );
    }

    // Parse optional body for the typed-phrase confirmation. Old callers
    // that don't send one will fail the check below, which is the intent.
    const body = (await request.json().catch(() => null)) as {
      confirmation?: string;
    } | null;

    const phraseCheck = checkConfirmationPhrase(
      body?.confirmation,
      CONFIRMATION_PHRASES.WITHDRAWAL_APPROVE,
    );
    if (!phraseCheck.ok) {
      await logAdminAction({
        actor: user,
        action: AdminActionType.WITHDRAWAL_APPROVE,
        outcome: "BLOCKED",
        targetType: "Withdrawal",
        targetId: id,
        errorMessage: phraseCheck.error,
        context: auditCtx,
      });
      return NextResponse.json({ error: phraseCheck.error }, { status: 400 });
    }

    // L4 — MFA check. If no recent MFA, this returns a 202 { requiresMfa }
    // response the client will use to prompt for the email code.
    const mfa = await requireFreshMfa(user, MFA_ACTION_TAG_MONEY, {
      ipAddress: auditCtx.ipAddress,
      userAgent: auditCtx.userAgent,
    });
    if (!mfa.ok) return mfa.response;

    const withdrawal = await prisma.withdrawal.findUnique({
      where: { id },
      include: {
        creative: { select: { email: true } },
      },
    });

    if (!withdrawal) {
      return NextResponse.json({ error: "Withdrawal not found" }, { status: 404 });
    }

    if (withdrawal.status !== WithdrawalStatus.PENDING) {
      return NextResponse.json(
        {
          error: "Only PENDING withdrawals can be approved",
          currentStatus: withdrawal.status,
        },
        { status: 400 },
      );
    }

    const balance = await getUserTokenBalance(withdrawal.creativeId);

    if (withdrawal.amountTokens > balance) {
      return NextResponse.json(
        {
          error: "Creative does not have enough tokens at approval time",
          availableBalance: balance,
          requestedAmount: withdrawal.amountTokens,
        },
        { status: 400 },
      );
    }

    // L6 — 2-person approval on large withdrawals. Below the threshold,
    // a single approver is enough and we fall through to the existing
    // ledger transaction. At/above the threshold we collect signatures
    // from two distinct SITE_OWNERs before flipping the status.
    if (requiresCoApproval(withdrawal.amountTokens)) {
      // Reject a double-sign with a clear message instead of leaving the
      // owner confused why their click does nothing.
      if (await hasAlreadyApproved(withdrawal.id, user.id)) {
        return NextResponse.json(
          {
            error:
              "You have already signed this withdrawal. A second owner still needs to approve.",
          },
          { status: 409 },
        );
      }

      // Record the current signer's approval row. This both audits who
      // signed and drives the count that `evaluateCoApproval` consults.
      await recordApproval({
        withdrawalId: withdrawal.id,
        approverId: user.id,
        ipAddress: auditCtx.ipAddress,
        userAgent: auditCtx.userAgent,
      });

      const snapshot = await evaluateCoApproval(withdrawal.id);

      if (!snapshot.hasEnough) {
        // First signature landed but we still need another owner.
        // Notify the OTHER SITE_OWNERs by email and return a 202 so the
        // UI can render "Awaiting co-approval".
        await sendCoApprovalRequest({
          withdrawalId: withdrawal.id,
          amountTokens: withdrawal.amountTokens,
          creativeEmail: withdrawal.creative?.email,
          firstApproverEmail: user.email,
          alreadyApproverIds: snapshot.approverIds,
        });

        await logAdminAction({
          actor: user,
          action: AdminActionType.WITHDRAWAL_APPROVE,
          outcome: "SUCCESS",
          targetType: "Withdrawal",
          targetId: withdrawal.id,
          metadata: {
            op: "coapproval-first-signature",
            amountTokens: withdrawal.amountTokens,
            currentApprovalCount: snapshot.currentApprovalCount,
            requiredApprovals: snapshot.requiredApprovals,
            thresholdTokens: snapshot.thresholdTokens,
          },
          context: auditCtx,
        });

        return NextResponse.json(
          {
            awaitingCoApproval: true,
            currentApprovalCount: snapshot.currentApprovalCount,
            requiredApprovals: snapshot.requiredApprovals,
            thresholdTokens: snapshot.thresholdTokens,
            message:
              "Your approval is recorded. Another site owner must also approve this withdrawal before it completes.",
          },
          { status: 202 },
        );
      }

      // snapshot.hasEnough — either 2 signatures collected, or the
      // single-owner bypass. Fall through to the ledger transaction with
      // a flag in the audit metadata for the bypass case.
      if (snapshot.bypassedSingleOwner) {
        console.warn(
          "[withdrawal-coapproval] single-owner bypass on large withdrawal — add a second SITE_OWNER for real 2-person protection.",
        );
      }
    }

    // Ledger write + status update in a single transaction.
    const result = await prisma.$transaction(async (tx) => {
      // Ledger DEBIT
      const ledgerResult = await applyUserLedgerEntry({
        userId: withdrawal.creativeId,
        amount: withdrawal.amountTokens,
        direction: "DEBIT",
        reason: "WITHDRAW",
        notes: `Withdrawal approved (id: ${withdrawal.id})`,
        metadata: {
          withdrawalId: withdrawal.id,
        },
      });

      const updated = await tx.withdrawal.update({
        where: { id: withdrawal.id },
        data: {
          status: WithdrawalStatus.APPROVED,
          approvedAt: new Date(),
          metadata: {
            ...(typeof withdrawal.metadata === "object" &&
            withdrawal.metadata !== null &&
            !Array.isArray(withdrawal.metadata)
              ? (withdrawal.metadata as Prisma.JsonObject)
              : {}),
            ledgerEntryId: ledgerResult.ledger.id,
          },
        },
      });

      return {
        updated,
        ledgerEntryId: ledgerResult.ledger.id,
        creativeBalanceAfter: ledgerResult.balanceAfter,
      };
    });

    await logAdminAction({
      actor: user,
      action: AdminActionType.WITHDRAWAL_APPROVE,
      outcome: "SUCCESS",
      targetType: "Withdrawal",
      targetId: withdrawal.id,
      metadata: {
        amountTokens: withdrawal.amountTokens,
        creativeId: withdrawal.creativeId,
        ledgerEntryId: result.ledgerEntryId,
        creativeBalanceAfter: result.creativeBalanceAfter,
      },
      context: auditCtx,
    });

    return NextResponse.json(
      {
        message: "Withdrawal approved and token debit applied",
        withdrawal: result.updated,
        ledgerEntryId: result.ledgerEntryId,
        creativeBalanceAfter: result.creativeBalanceAfter,
      },
      { status: 200 },
    );
  } catch (error) {
    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[POST /api/admin/withdrawals/:id/approve] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
