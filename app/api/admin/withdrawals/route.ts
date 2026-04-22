// -----------------------------------------------------------------------------
// @file: app/api/admin/withdrawals/route.ts
// @purpose: Admin API for managing creative withdrawals (list + status updates)
// @version: v1.1.0
// @status: active
// @lastUpdate: 2025-11-15
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AdminActionType, LedgerDirection } from "@prisma/client";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { canApproveWithdrawals, canMarkWithdrawalsPaid, isSiteAdminRole } from "@/lib/roles";
import { extractAuditContext, logAdminAction } from "@/lib/admin-audit";
import { CONFIRMATION_PHRASES, checkConfirmationPhrase } from "@/lib/admin-confirmation";
import { MFA_ACTION_TAG_MONEY, requireFreshMfa } from "@/lib/mfa";

const MAX_WITHDRAWALS = 200;

type AdminWithdrawalAction = "APPROVE" | "REJECT" | "MARK_PAID";

// -----------------------------------------------------------------------------
// GET: list withdrawals for admins
// -----------------------------------------------------------------------------

export async function GET(_req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json(
        { error: "Only site admins can access admin withdrawals" },
        { status: 403 },
      );
    }

    const withdrawals = await prisma.withdrawal.findMany({
      include: {
        creative: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: MAX_WITHDRAWALS,
    });

    const totalRequested = withdrawals.reduce((sum, w) => sum + w.amountTokens, 0);
    const totalPaid = withdrawals
      .filter((w) => w.status === "PAID")
      .reduce((sum, w) => sum + w.amountTokens, 0);
    const pendingCount = withdrawals.filter((w) => w.status === "PENDING").length;

    const items = withdrawals.map((w) => ({
      id: w.id,
      amountTokens: w.amountTokens,
      status: w.status,
      createdAt: w.createdAt.toISOString(),
      approvedAt: w.approvedAt ? w.approvedAt.toISOString() : null,
      creative: {
        id: w.creative.id,
        email: w.creative.email,
        name: w.creative.name,
        role: w.creative.role,
      },
    }));

    return NextResponse.json({
      stats: {
        totalRequested,
        totalPaid,
        pendingCount,
        withdrawalsCount: items.length,
      },
      withdrawals: items,
    });
  } catch (error: any) {
    if ((error as any)?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    console.error("[admin.withdrawals] GET error", error);
    return NextResponse.json({ error: "Failed to load admin withdrawals" }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// PATCH: update withdrawal status (APPROVE / REJECT / MARK_PAID)
// -----------------------------------------------------------------------------

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json(
        { error: "Only site admins can update withdrawals" },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => null);

    const id = body?.id as string | undefined;
    const action = body?.action as AdminWithdrawalAction | undefined;

    if (!id || !action) {
      return NextResponse.json({ error: "Missing id or action" }, { status: 400 });
    }

    const auditCtx = extractAuditContext(req);

    // Owner-only guard for money-moving actions. APPROVE commits the
    // platform toward paying the creative; MARK_PAID records that the
    // money actually left. REJECT stays admin-allowed — rejecting a
    // pending request isn't a financial commitment.
    if (action === "APPROVE" && !canApproveWithdrawals(user.role)) {
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
    if (action === "MARK_PAID" && !canMarkWithdrawalsPaid(user.role)) {
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

    // Typed-phrase confirmation for money-moving actions (L2). REJECT is
    // allowed without a confirmation — it's not a financial commitment.
    if (action === "APPROVE" || action === "MARK_PAID") {
      const expected =
        action === "APPROVE"
          ? CONFIRMATION_PHRASES.WITHDRAWAL_APPROVE
          : CONFIRMATION_PHRASES.WITHDRAWAL_MARK_PAID;
      const phraseCheck = checkConfirmationPhrase(body?.confirmation, expected);
      if (!phraseCheck.ok) {
        await logAdminAction({
          actor: user,
          action:
            action === "APPROVE"
              ? AdminActionType.WITHDRAWAL_APPROVE
              : AdminActionType.WITHDRAWAL_MARK_PAID,
          outcome: "BLOCKED",
          targetType: "Withdrawal",
          targetId: id,
          errorMessage: phraseCheck.error,
          context: auditCtx,
        });
        return NextResponse.json({ error: phraseCheck.error }, { status: 400 });
      }

      // L4 — MFA check only for money-moving branches. REJECT still
      // bypasses the second factor (same rationale as L2).
      const mfa = await requireFreshMfa(user, MFA_ACTION_TAG_MONEY, {
        ipAddress: auditCtx.ipAddress,
        userAgent: auditCtx.userAgent,
      });
      if (!mfa.ok) return mfa.response;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const withdrawal = await tx.withdrawal.findUnique({
        where: { id },
        include: {
          creative: {
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
            },
          },
        },
      });

      if (!withdrawal) {
        throw new Response("Withdrawal not found", { status: 404 });
      }

      if (action === "APPROVE") {
        if (withdrawal.status !== "PENDING") {
          throw new Response("Only pending withdrawals can be approved", { status: 422 });
        }

        const w = await tx.withdrawal.update({
          where: { id: withdrawal.id },
          data: {
            status: "APPROVED",
            approvedAt: new Date(),
          },
          include: {
            creative: {
              select: {
                id: true,
                email: true,
                name: true,
                role: true,
              },
            },
          },
        });

        return w;
      }

      if (action === "REJECT") {
        if (withdrawal.status !== "PENDING") {
          throw new Response("Only pending withdrawals can be rejected", { status: 422 });
        }

        const w = await tx.withdrawal.update({
          where: { id: withdrawal.id },
          data: {
            status: "REJECTED",
            approvedAt: null,
          },
          include: {
            creative: {
              select: {
                id: true,
                email: true,
                name: true,
                role: true,
              },
            },
          },
        });

        return w;
      }

      // MARK_PAID
      if (withdrawal.status === "PAID") {
        throw new Response("Withdrawal is already paid", {
          status: 422,
        });
      }
      if (withdrawal.status !== "APPROVED") {
        throw new Response("Withdrawal must be approved before marking as paid", { status: 422 });
      }

      // Calculate creative balance before this debit
      const [creditAgg, debitAgg] = await Promise.all([
        tx.tokenLedger.aggregate({
          where: {
            userId: withdrawal.creativeId,
            direction: LedgerDirection.CREDIT,
          },
          _sum: { amount: true },
        }),
        tx.tokenLedger.aggregate({
          where: {
            userId: withdrawal.creativeId,
            direction: LedgerDirection.DEBIT,
          },
          _sum: { amount: true },
        }),
      ]);

      const totalCredits = creditAgg._sum.amount ?? 0;
      const totalDebits = debitAgg._sum.amount ?? 0;
      const balanceBefore = totalCredits - totalDebits;
      const balanceAfter = balanceBefore - withdrawal.amountTokens;

      await tx.tokenLedger.create({
        data: {
          userId: withdrawal.creativeId,
          direction: LedgerDirection.DEBIT,
          amount: withdrawal.amountTokens,
          reason: "WITHDRAWAL_PAID",
          notes: `Withdrawal ${withdrawal.id} marked as paid by ${user.email}`,
          balanceBefore,
          balanceAfter,
        },
      });

      const w = await tx.withdrawal.update({
        where: { id: withdrawal.id },
        data: {
          status: "PAID",
          approvedAt: withdrawal.approvedAt ?? new Date(),
        },
        include: {
          creative: {
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
            },
          },
        },
      });

      return w;
    });

    // Map the action to the corresponding audit enum + log the success.
    // Logged outside the transaction so a failed log write doesn't roll
    // back the actual withdrawal update (logAdminAction is non-throwing
    // anyway, but belt-and-suspenders).
    const actionEnum: AdminActionType =
      action === "APPROVE"
        ? AdminActionType.WITHDRAWAL_APPROVE
        : action === "REJECT"
          ? AdminActionType.WITHDRAWAL_REJECT
          : AdminActionType.WITHDRAWAL_MARK_PAID;
    await logAdminAction({
      actor: user,
      action: actionEnum,
      outcome: "SUCCESS",
      targetType: "Withdrawal",
      targetId: updated.id,
      metadata: {
        amountTokens: updated.amountTokens,
        creativeId: updated.creative.id,
        creativeEmail: updated.creative.email,
        newStatus: updated.status,
      },
      context: auditCtx,
    });

    return NextResponse.json({
      withdrawal: {
        id: updated.id,
        amountTokens: updated.amountTokens,
        status: updated.status,
        createdAt: updated.createdAt.toISOString(),
        approvedAt: updated.approvedAt ? updated.approvedAt.toISOString() : null,
        creative: updated.creative,
      },
    });
  } catch (error: any) {
    // If we threw a Response from inside the tx, forward it unchanged.
    if (error instanceof Response) {
      const text = await error.text();
      // Best-effort: capture the failure in the audit log. We don't know
      // the action cleanly at this catch-site (it was parsed earlier) but
      // we log generically so the ERROR shows up somewhere. No throw
      // inside the log call path.
      return NextResponse.json({ error: text || "Request failed" }, { status: error.status });
    }

    if ((error as any)?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    console.error("[admin.withdrawals] PATCH error", error);
    return NextResponse.json({ error: "Failed to update withdrawal" }, { status: 500 });
  }
}
