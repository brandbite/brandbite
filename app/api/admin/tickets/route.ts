// -----------------------------------------------------------------------------
// @file: app/api/admin/tickets/route.ts
// @purpose: Admin ticket list + manual designer assignment API
// @version: v0.1.0
// @status: experimental
// @lastUpdate: 2025-11-21
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import {
  applyCompanyLedgerEntry,
  getEffectiveTokenValues,
} from "@/lib/token-engine";

type PatchPayload = {
  ticketId?: string;
  designerId?: string | null;
  tokenCostOverride?: number | null;
  designerPayoutOverride?: number | null;
};

export async function GET(_req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    const isSiteAdmin =
      user.role === "SITE_OWNER" || user.role === "SITE_ADMIN";

    if (!isSiteAdmin) {
      return NextResponse.json(
        {
          error:
            "Only site owners or admins can access this endpoint.",
        },
        { status: 403 },
      );
    }

    const [tickets, designers] = await Promise.all([
      prisma.ticket.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          status: true,
          createdAt: true,
          quantity: true,
          tokenCostOverride: true,
          designerPayoutOverride: true,
          company: {
            select: {
              id: true,
              name: true,
            },
          },
          project: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          designer: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          jobType: {
            select: {
              id: true,
              name: true,
              tokenCost: true,
              designerPayoutTokens: true,
            },
          },
        },
      }),
      prisma.userAccount.findMany({
        where: {
          role: UserRole.DESIGNER,
        },
        select: {
          id: true,
          name: true,
          email: true,
        },
        orderBy: {
          name: "asc",
        },
      }),
    ]);

    return NextResponse.json(
      {
        tickets,
        designers,
      },
      { status: 200 },
    );
  } catch (error: any) {
    if (error?.code === "UNAUTHENTICATED") {
      return NextResponse.json(
        { error: "Unauthenticated" },
        { status: 401 },
      );
    }

    console.error("[GET /api/admin/tickets] error", error);
    return NextResponse.json(
      { error: "Failed to load tickets" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    const isSiteAdmin =
      user.role === "SITE_OWNER" || user.role === "SITE_ADMIN";

    if (!isSiteAdmin) {
      return NextResponse.json(
        {
          error:
            "Only site owners or admins can modify tickets.",
        },
        { status: 403 },
      );
    }

    const body = (await req.json()) as PatchPayload;
    const ticketId = body.ticketId;

    if (!ticketId) {
      return NextResponse.json(
        { error: "ticketId is required." },
        { status: 400 },
      );
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        companyId: true,
        quantity: true,
        tokenCostOverride: true,
        designerPayoutOverride: true,
        jobType: {
          select: {
            id: true,
            tokenCost: true,
            designerPayoutTokens: true,
          },
        },
      },
    });

    if (!ticket) {
      return NextResponse.json(
        { error: "Ticket not found." },
        { status: 404 },
      );
    }

    // -----------------------------------------------------------------------
    // Designer assignment (unchanged logic)
    // -----------------------------------------------------------------------
    const hasDesignerChange = "designerId" in body;
    const designerId = body.designerId ?? null;

    if (hasDesignerChange && designerId) {
      const designer = await prisma.userAccount.findFirst({
        where: {
          id: designerId,
          role: UserRole.DESIGNER,
        },
        select: {
          id: true,
        },
      });

      if (!designer) {
        return NextResponse.json(
          {
            error:
              "Designer not found or not a designer.",
          },
          { status: 400 },
        );
      }
    }

    // -----------------------------------------------------------------------
    // Token cost override with ledger reconciliation
    // -----------------------------------------------------------------------
    const hasCostOverrideChange = "tokenCostOverride" in body;
    const hasPayoutOverrideChange = "designerPayoutOverride" in body;

    // Parse override values: null means "clear override", number means "set"
    const newCostOverride = hasCostOverrideChange
      ? (typeof body.tokenCostOverride === "number" && body.tokenCostOverride >= 0
          ? body.tokenCostOverride
          : null)
      : undefined; // undefined = no change

    const newPayoutOverride = hasPayoutOverrideChange
      ? (typeof body.designerPayoutOverride === "number" && body.designerPayoutOverride >= 0
          ? body.designerPayoutOverride
          : null)
      : undefined;

    // If cost override changed, reconcile the company ledger
    if (hasCostOverrideChange && ticket.companyId && ticket.jobType) {
      const oldValues = getEffectiveTokenValues({
        quantity: ticket.quantity,
        tokenCostOverride: ticket.tokenCostOverride,
        designerPayoutOverride: ticket.designerPayoutOverride,
        jobType: ticket.jobType,
      });

      const newValues = getEffectiveTokenValues({
        quantity: ticket.quantity,
        tokenCostOverride: newCostOverride ?? null,
        designerPayoutOverride: ticket.designerPayoutOverride,
        jobType: ticket.jobType,
      });

      const costDelta = newValues.effectiveCost - oldValues.effectiveCost;

      if (costDelta !== 0) {
        // Positive delta = cost increased → debit more from company
        // Negative delta = cost decreased → credit back to company
        await applyCompanyLedgerEntry({
          companyId: ticket.companyId,
          ticketId: ticket.id,
          amount: Math.abs(costDelta),
          direction: costDelta > 0 ? "DEBIT" : "CREDIT",
          reason: "ADMIN_ADJUSTMENT",
          notes: `Admin token cost override: ${oldValues.effectiveCost} → ${newValues.effectiveCost}`,
          metadata: {
            adminUserId: user.id,
            oldEffectiveCost: oldValues.effectiveCost,
            newEffectiveCost: newValues.effectiveCost,
            oldOverride: ticket.tokenCostOverride,
            newOverride: newCostOverride ?? null,
          },
        });
      }
    }

    // -----------------------------------------------------------------------
    // Update ticket
    // -----------------------------------------------------------------------
    const updateData: Record<string, unknown> = {};
    if (hasDesignerChange) updateData.designerId = designerId;
    if (newCostOverride !== undefined) updateData.tokenCostOverride = newCostOverride;
    if (newPayoutOverride !== undefined) updateData.designerPayoutOverride = newPayoutOverride;

    const updated = await prisma.ticket.update({
      where: { id: ticketId },
      data: updateData,
      select: {
        id: true,
        quantity: true,
        tokenCostOverride: true,
        designerPayoutOverride: true,
        designer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        jobType: {
          select: {
            id: true,
            name: true,
            tokenCost: true,
            designerPayoutTokens: true,
          },
        },
      },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (error: any) {
    if (error?.code === "UNAUTHENTICATED") {
      return NextResponse.json(
        { error: "Unauthenticated" },
        { status: 401 },
      );
    }

    console.error("[PATCH /api/admin/tickets] error", error);
    return NextResponse.json(
      { error: "Failed to update ticket" },
      { status: 500 },
    );
  }
}
