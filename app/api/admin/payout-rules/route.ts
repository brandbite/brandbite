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
import { parseBody } from "@/lib/schemas/helpers";
import { createPayoutRuleSchema, updatePayoutRuleSchema } from "@/lib/schemas/payout-rule.schemas";

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

    const parsed = await parseBody(req, createPayoutRuleSchema);
    if (!parsed.success) return parsed.response;
    const {
      name,
      description,
      minCompletedTickets,
      timeWindowDays,
      payoutPercent,
      priority,
      isActive,
    } = parsed.data;

    // Business rule: payoutPercent must be > BASE_PAYOUT_PERCENT
    if (payoutPercent <= BASE_PAYOUT_PERCENT) {
      return NextResponse.json(
        { error: `payoutPercent must be between ${BASE_PAYOUT_PERCENT + 1} and 100` },
        { status: 400 },
      );
    }

    const created = await prisma.payoutRule.create({
      data: {
        name,
        description,
        minCompletedTickets,
        timeWindowDays,
        payoutPercent,
        priority,
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

    const parsed = await parseBody(req, updatePayoutRuleSchema);
    if (!parsed.success) return parsed.response;
    const { id, ...fields } = parsed.data;

    // Business rule: payoutPercent must be > BASE_PAYOUT_PERCENT
    if (fields.payoutPercent !== undefined && fields.payoutPercent <= BASE_PAYOUT_PERCENT) {
      return NextResponse.json(
        { error: `payoutPercent must be between ${BASE_PAYOUT_PERCENT + 1} and 100` },
        { status: 400 },
      );
    }

    const data: Record<string, unknown> = {};
    if (fields.name !== undefined) data.name = fields.name;
    if (fields.description !== undefined) data.description = fields.description;
    if (fields.minCompletedTickets !== undefined)
      data.minCompletedTickets = fields.minCompletedTickets;
    if (fields.timeWindowDays !== undefined) data.timeWindowDays = fields.timeWindowDays;
    if (fields.payoutPercent !== undefined) data.payoutPercent = fields.payoutPercent;
    if (fields.priority !== undefined) data.priority = fields.priority;
    if (fields.isActive !== undefined) data.isActive = fields.isActive;

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
