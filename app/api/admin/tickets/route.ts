// -----------------------------------------------------------------------------
// @file: app/api/admin/tickets/route.ts
// @purpose: Admin ticket list + manual creative assignment API
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
  creativeId?: string | null;
  tokenCostOverride?: number | null;
  creativePayoutOverride?: number | null;
};

export async function GET(req: NextRequest) {
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

    // ── Parse query params ──────────────────────────────────────────────
    const url = new URL(req.url);
    const search = url.searchParams.get("search")?.trim() || "";
    const status = url.searchParams.get("status") || "";
    const companyId = url.searchParams.get("company") || "";
    const sortBy = url.searchParams.get("sortBy") || "createdAt";
    const sortDir = url.searchParams.get("sortDir") || "desc";
    const limit = Math.min(
      Math.max(parseInt(url.searchParams.get("limit") || "50", 10), 1),
      200,
    );
    const offset = Math.max(
      parseInt(url.searchParams.get("offset") || "0", 10),
      0,
    );

    // ── Build where clause ──────────────────────────────────────────────
    const where: any = {};

    if (
      status &&
      ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"].includes(status)
    ) {
      where.status = status;
    }

    if (companyId) {
      where.companyId = companyId;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { company: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    // ── Build orderBy ───────────────────────────────────────────────────
    const dir = sortDir === "asc" ? "asc" : "desc";
    const validSortFields: Record<string, any> = {
      createdAt: { createdAt: dir },
      status: { status: dir },
      title: { title: dir },
    };
    const orderBy = validSortFields[sortBy] || { createdAt: "desc" };

    // ── Execute query + count + creatives in parallel ───────────────────
    const [tickets, totalCount, creatives] = await Promise.all([
      prisma.ticket.findMany({
        where,
        orderBy,
        take: limit,
        skip: offset,
        select: {
          id: true,
          title: true,
          status: true,
          createdAt: true,
          quantity: true,
          tokenCostOverride: true,
          creativePayoutOverride: true,
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
          creative: {
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
              creativePayoutTokens: true,
            },
          },
        },
      }),
      prisma.ticket.count({ where }),
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
        creatives,
        pagination: {
          total: totalCount,
          limit,
          offset,
          hasMore: offset + limit < totalCount,
        },
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
        creativePayoutOverride: true,
        jobType: {
          select: {
            id: true,
            tokenCost: true,
            creativePayoutTokens: true,
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
    // Creative assignment (unchanged logic)
    // -----------------------------------------------------------------------
    const hasCreativeChange = "creativeId" in body;
    const creativeId = body.creativeId ?? null;

    if (hasCreativeChange && creativeId) {
      const creative = await prisma.userAccount.findFirst({
        where: {
          id: creativeId,
          role: UserRole.DESIGNER,
        },
        select: {
          id: true,
        },
      });

      if (!creative) {
        return NextResponse.json(
          {
            error:
              "Creative not found or not a creative.",
          },
          { status: 400 },
        );
      }
    }

    // -----------------------------------------------------------------------
    // Token cost override with ledger reconciliation
    // -----------------------------------------------------------------------
    const hasCostOverrideChange = "tokenCostOverride" in body;
    const hasPayoutOverrideChange = "creativePayoutOverride" in body;

    // Parse override values: null means "clear override", number means "set"
    const newCostOverride = hasCostOverrideChange
      ? (typeof body.tokenCostOverride === "number" && body.tokenCostOverride >= 0
          ? body.tokenCostOverride
          : null)
      : undefined; // undefined = no change

    const newPayoutOverride = hasPayoutOverrideChange
      ? (typeof body.creativePayoutOverride === "number" && body.creativePayoutOverride >= 0
          ? body.creativePayoutOverride
          : null)
      : undefined;

    // If cost override changed, reconcile the company ledger
    if (hasCostOverrideChange && ticket.companyId && ticket.jobType) {
      const oldValues = getEffectiveTokenValues({
        quantity: ticket.quantity,
        tokenCostOverride: ticket.tokenCostOverride,
        creativePayoutOverride: ticket.creativePayoutOverride,
        jobType: ticket.jobType,
      });

      const newValues = getEffectiveTokenValues({
        quantity: ticket.quantity,
        tokenCostOverride: newCostOverride ?? null,
        creativePayoutOverride: ticket.creativePayoutOverride,
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
    if (hasCreativeChange) updateData.creativeId = creativeId;
    if (newCostOverride !== undefined) updateData.tokenCostOverride = newCostOverride;
    if (newPayoutOverride !== undefined) updateData.creativePayoutOverride = newPayoutOverride;

    const updated = await prisma.ticket.update({
      where: { id: ticketId },
      data: updateData,
      select: {
        id: true,
        quantity: true,
        tokenCostOverride: true,
        creativePayoutOverride: true,
        creative: {
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
            creativePayoutTokens: true,
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
