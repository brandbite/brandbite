// -----------------------------------------------------------------------------
// @file: app/api/admin/payout-rules/route.ts
// @purpose: Admin API for managing payout rules (gamification tiers)
// @version: v1.0.0
// @status: active
// @lastUpdate: 2025-11-25
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { isSiteAdminRole } from "@/lib/roles";
import { BASE_PAYOUT_PERCENT } from "@/lib/token-engine";

// -----------------------------------------------------------------------------
// GET: list all payout rules
// -----------------------------------------------------------------------------

export async function GET(_req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json(
        { error: "Only site admins can access payout rules" },
        { status: 403 },
      );
    }

    const rules = await prisma.payoutRule.findMany({
      orderBy: { payoutPercent: "desc" },
    });

    const items = rules.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      minCompletedTickets: r.minCompletedTickets,
      timeWindowDays: r.timeWindowDays,
      payoutPercent: r.payoutPercent,
      priority: r.priority,
      isActive: r.isActive,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));

    return NextResponse.json({ payoutRules: items, basePayoutPercent: BASE_PAYOUT_PERCENT });
  } catch (error: any) {
    if ((error as any)?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[admin.payout-rules] GET error", error);
    return NextResponse.json({ error: "Failed to load payout rules" }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// POST: create new payout rule
// -----------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json(
        { error: "Only site admins can create payout rules" },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => null);

    const name = (body?.name as string | undefined)?.trim();
    const description = (body?.description as string | undefined)?.trim() || null;
    const minCompletedTickets = typeof body?.minCompletedTickets === "number" ? body.minCompletedTickets : NaN;
    const timeWindowDays = typeof body?.timeWindowDays === "number" ? body.timeWindowDays : NaN;
    const payoutPercent = typeof body?.payoutPercent === "number" ? body.payoutPercent : NaN;
    const priority = typeof body?.priority === "number" ? body.priority : 0;
    const isActive = typeof body?.isActive === "boolean" ? body.isActive : true;

    if (!name) {
      return NextResponse.json({ error: "Rule name is required" }, { status: 400 });
    }

    if (!Number.isFinite(minCompletedTickets) || minCompletedTickets < 1) {
      return NextResponse.json(
        { error: "minCompletedTickets must be a positive integer" },
        { status: 400 },
      );
    }

    if (!Number.isFinite(timeWindowDays) || timeWindowDays < 1) {
      return NextResponse.json(
        { error: "timeWindowDays must be a positive integer" },
        { status: 400 },
      );
    }

    if (!Number.isFinite(payoutPercent) || payoutPercent <= BASE_PAYOUT_PERCENT || payoutPercent > 100) {
      return NextResponse.json(
        { error: `payoutPercent must be between ${BASE_PAYOUT_PERCENT + 1} and 100` },
        { status: 400 },
      );
    }

    const created = await prisma.payoutRule.create({
      data: {
        name,
        description,
        minCompletedTickets: Math.round(minCompletedTickets),
        timeWindowDays: Math.round(timeWindowDays),
        payoutPercent: Math.round(payoutPercent),
        priority: Math.round(priority),
        isActive,
      },
    });

    return NextResponse.json(
      {
        payoutRule: {
          id: created.id,
          name: created.name,
          description: created.description,
          minCompletedTickets: created.minCompletedTickets,
          timeWindowDays: created.timeWindowDays,
          payoutPercent: created.payoutPercent,
          priority: created.priority,
          isActive: created.isActive,
          createdAt: created.createdAt.toISOString(),
          updatedAt: created.updatedAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (error: any) {
    if ((error as any)?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[admin.payout-rules] POST error", error);
    return NextResponse.json({ error: "Failed to create payout rule" }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// PATCH: update an existing payout rule
// -----------------------------------------------------------------------------

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json(
        { error: "Only site admins can update payout rules" },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => null);

    const id = body?.id as string | undefined;
    if (!id) {
      return NextResponse.json({ error: "Payout rule id is required" }, { status: 400 });
    }

    const data: {
      name?: string;
      description?: string | null;
      minCompletedTickets?: number;
      timeWindowDays?: number;
      payoutPercent?: number;
      priority?: number;
      isActive?: boolean;
    } = {};

    if (typeof body?.name === "string") {
      const trimmed = body.name.trim();
      if (!trimmed) {
        return NextResponse.json({ error: "Rule name cannot be empty" }, { status: 400 });
      }
      data.name = trimmed;
    }

    if (body?.description === null) {
      data.description = null;
    } else if (typeof body?.description === "string") {
      data.description = body.description.trim() || null;
    }

    if (typeof body?.minCompletedTickets === "number") {
      if (!Number.isFinite(body.minCompletedTickets) || body.minCompletedTickets < 1) {
        return NextResponse.json(
          { error: "minCompletedTickets must be a positive integer" },
          { status: 400 },
        );
      }
      data.minCompletedTickets = Math.round(body.minCompletedTickets);
    }

    if (typeof body?.timeWindowDays === "number") {
      if (!Number.isFinite(body.timeWindowDays) || body.timeWindowDays < 1) {
        return NextResponse.json(
          { error: "timeWindowDays must be a positive integer" },
          { status: 400 },
        );
      }
      data.timeWindowDays = Math.round(body.timeWindowDays);
    }

    if (typeof body?.payoutPercent === "number") {
      if (
        !Number.isFinite(body.payoutPercent) ||
        body.payoutPercent <= BASE_PAYOUT_PERCENT ||
        body.payoutPercent > 100
      ) {
        return NextResponse.json(
          { error: `payoutPercent must be between ${BASE_PAYOUT_PERCENT + 1} and 100` },
          { status: 400 },
        );
      }
      data.payoutPercent = Math.round(body.payoutPercent);
    }

    if (typeof body?.priority === "number") {
      data.priority = Math.round(body.priority);
    }

    if (typeof body?.isActive === "boolean") {
      data.isActive = body.isActive;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const updated = await prisma.payoutRule.update({
      where: { id },
      data,
    });

    return NextResponse.json({
      payoutRule: {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        minCompletedTickets: updated.minCompletedTickets,
        timeWindowDays: updated.timeWindowDays,
        payoutPercent: updated.payoutPercent,
        priority: updated.priority,
        isActive: updated.isActive,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (error: any) {
    if ((error as any)?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[admin.payout-rules] PATCH error", error);
    return NextResponse.json({ error: "Failed to update payout rule" }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// DELETE: remove a payout rule
// -----------------------------------------------------------------------------

export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json(
        { error: "Only site admins can delete payout rules" },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Payout rule id is required" }, { status: 400 });
    }

    await prisma.payoutRule.delete({ where: { id } });

    return NextResponse.json({ deleted: true });
  } catch (error: any) {
    if ((error as any)?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[admin.payout-rules] DELETE error", error);
    return NextResponse.json({ error: "Failed to delete payout rule" }, { status: 500 });
  }
}
