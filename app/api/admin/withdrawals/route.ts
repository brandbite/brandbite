// -----------------------------------------------------------------------------
// @file: app/api/admin/withdrawals/route.ts
// @purpose: Admin API for managing designer withdrawals (list + status updates)
// @version: v1.1.0
// @status: active
// @lastUpdate: 2025-11-15
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { LedgerDirection } from "@prisma/client";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { isSiteAdminRole } from "@/lib/roles";

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
        designer: {
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

    const totalRequested = withdrawals.reduce(
      (sum, w) => sum + w.amountTokens,
      0,
    );
    const totalPaid = withdrawals
      .filter((w) => w.status === "PAID")
      .reduce((sum, w) => sum + w.amountTokens, 0);
    const pendingCount = withdrawals.filter(
      (w) => w.status === "PENDING",
    ).length;

    const items = withdrawals.map((w) => ({
      id: w.id,
      amountTokens: w.amountTokens,
      status: w.status,
      createdAt: w.createdAt.toISOString(),
      approvedAt: w.approvedAt ? w.approvedAt.toISOString() : null,
      designer: {
        id: w.designer.id,
        email: w.designer.email,
        name: w.designer.name,
        role: w.designer.role,
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
      return NextResponse.json(
        { error: "Unauthenticated" },
        { status: 401 },
      );
    }

    console.error("[admin.withdrawals] GET error", error);
    return NextResponse.json(
      { error: "Failed to load admin withdrawals" },
      { status: 500 },
    );
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
      return NextResponse.json(
        { error: "Missing id or action" },
        { status: 400 },
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const withdrawal = await tx.withdrawal.findUnique({
        where: { id },
        include: {
          designer: {
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
          throw new Response(
            "Only pending withdrawals can be approved",
            { status: 422 },
          );
        }

        const w = await tx.withdrawal.update({
          where: { id: withdrawal.id },
          data: {
            status: "APPROVED",
            approvedAt: new Date(),
          },
          include: {
            designer: {
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
          throw new Response(
            "Only pending withdrawals can be rejected",
            { status: 422 },
          );
        }

        const w = await tx.withdrawal.update({
          where: { id: withdrawal.id },
          data: {
            status: "REJECTED",
            approvedAt: null,
          },
          include: {
            designer: {
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
        throw new Response(
          "Withdrawal must be approved before marking as paid",
          { status: 422 },
        );
      }

      // Calculate designer balance before this debit
      const [creditAgg, debitAgg] = await Promise.all([
        tx.tokenLedger.aggregate({
          where: {
            userId: withdrawal.designerId,
            direction: LedgerDirection.CREDIT,
          },
          _sum: { amount: true },
        }),
        tx.tokenLedger.aggregate({
          where: {
            userId: withdrawal.designerId,
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
          userId: withdrawal.designerId,
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
          designer: {
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

    return NextResponse.json({
      withdrawal: {
        id: updated.id,
        amountTokens: updated.amountTokens,
        status: updated.status,
        createdAt: updated.createdAt.toISOString(),
        approvedAt: updated.approvedAt
          ? updated.approvedAt.toISOString()
          : null,
        designer: updated.designer,
      },
    });
  } catch (error: any) {
    // tx içinden Response fırlattıysak onu aynen geçir
    if (error instanceof Response) {
      const text = await error.text();
      return NextResponse.json(
        { error: text || "Request failed" },
        { status: error.status },
      );
    }

    if ((error as any)?.code === "UNAUTHENTICATED") {
      return NextResponse.json(
        { error: "Unauthenticated" },
        { status: 401 },
      );
    }

    console.error("[admin.withdrawals] PATCH error", error);
    return NextResponse.json(
      { error: "Failed to update withdrawal" },
      { status: 500 },
    );
  }
}
