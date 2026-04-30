// -----------------------------------------------------------------------------
// @file: app/api/admin/plans/route.ts
// @purpose: Admin API for managing subscription plans (with Stripe mapping)
// @version: v1.1.0
// @status: active
// @lastUpdate: 2025-11-17
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { AdminActionType, Prisma, type UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { extractAuditContext, logAdminAction } from "@/lib/admin-audit";
import { canManagePlans, isSiteAdminRole } from "@/lib/roles";
import { parseBody } from "@/lib/schemas/helpers";
import { createPlanSchema, updatePlanSchema } from "@/lib/schemas/plan.schemas";

type PlanResponseItem = {
  id: string;
  name: string;
  monthlyTokens: number;
  priceCents: number | null;
  isActive: boolean;
  isRecurring: boolean;
  stripeProductId: string | null;
  stripePriceId: string | null;
  /** Marketing copy fields. Editable in the admin form. Public
   *  /api/plans surfaces these to the landing-page card. */
  tagline: string | null;
  features: string[] | null;
  displayCtaLabel: string | null;
  displaySubtitle: string | null;
  displayOrder: number | null;
  attachedCompanies: number;
  createdAt: string;
  updatedAt: string;
};

type PlansResponse = {
  plans: PlanResponseItem[];
};

function coerceFeatures(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const safe = raw.filter((v): v is string => typeof v === "string");
  return safe.length > 0 ? safe : null;
}

function requireAdmin(userRole: UserRole) {
  if (!isSiteAdminRole(userRole)) {
    const error: Error & { code?: string; status?: number } = new Error(
      "You do not have permission to view plans.",
    );
    error.code = "FORBIDDEN";
    error.status = 403;
    throw error;
  }
}

// -----------------------------------------------------------------------------
// GET: list plans
// -----------------------------------------------------------------------------

export async function GET() {
  try {
    const user = await getCurrentUserOrThrow();
    requireAdmin(user.role);

    const plans = await prisma.plan.findMany({
      orderBy: { monthlyTokens: "asc" },
      include: {
        _count: {
          select: { companies: true },
        },
      },
    });

    const payload: PlansResponse = {
      plans: plans.map((p) => ({
        id: p.id,
        name: p.name,
        monthlyTokens: p.monthlyTokens,
        priceCents: p.priceCents,
        isActive: p.isActive,
        isRecurring: p.isRecurring,
        stripeProductId: p.stripeProductId,
        stripePriceId: p.stripePriceId,
        tagline: p.tagline,
        features: coerceFeatures(p.features),
        displayCtaLabel: p.displayCtaLabel,
        displaySubtitle: p.displaySubtitle,
        displayOrder: p.displayOrder,
        attachedCompanies: p._count.companies,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      })),
    };

    return NextResponse.json(payload, { status: 200 });
  } catch (error: any) {
    if (error?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    if (error?.code === "FORBIDDEN") {
      return NextResponse.json({ error: error.message }, { status: error.status ?? 403 });
    }

    console.error("[admin.plans] GET error", error);
    return NextResponse.json({ error: "Failed to load plans." }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// POST: create plan
// -----------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();
    const auditCtx = extractAuditContext(req);
    requireAdmin(user.role);

    if (!canManagePlans(user.role)) {
      await logAdminAction({
        actor: user,
        action: AdminActionType.PLAN_CREATE,
        outcome: "BLOCKED",
        errorMessage: "Only site owners can create plans.",
        context: auditCtx,
      });
      return NextResponse.json({ error: "Only site owners can create plans." }, { status: 403 });
    }

    const parsed = await parseBody(req, createPlanSchema);
    if (!parsed.success) return parsed.response;
    const {
      name,
      monthlyTokens,
      priceCents,
      isActive,
      isRecurring,
      stripeProductId,
      stripePriceId,
      tagline,
      features,
      displayCtaLabel,
      displaySubtitle,
      displayOrder,
    } = parsed.data;

    const created = await prisma.plan.create({
      data: {
        name,
        monthlyTokens,
        priceCents: priceCents ?? 0,
        isActive,
        isRecurring,
        stripeProductId,
        stripePriceId,
        tagline: tagline ?? null,
        // Prisma's nullable Json columns need `Prisma.DbNull` for SQL
        // NULL — passing literal `null` is rejected by the generated
        // types. Use the helper to clear the column when the form
        // submitted no features.
        features: features ?? Prisma.DbNull,
        displayCtaLabel: displayCtaLabel ?? null,
        displaySubtitle: displaySubtitle ?? null,
        displayOrder: displayOrder ?? null,
      },
    });

    await logAdminAction({
      actor: user,
      action: AdminActionType.PLAN_CREATE,
      outcome: "SUCCESS",
      targetType: "Plan",
      targetId: created.id,
      metadata: {
        name,
        monthlyTokens,
        priceCents: priceCents ?? 0,
        isRecurring,
        isActive,
      },
      context: auditCtx,
    });

    return NextResponse.json(
      {
        id: created.id,
      },
      { status: 201 },
    );
  } catch (error: any) {
    if (error?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    if (error?.code === "FORBIDDEN") {
      return NextResponse.json({ error: error.message }, { status: error.status ?? 403 });
    }

    console.error("[admin.plans] POST error", error);
    return NextResponse.json({ error: "Failed to create plan." }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// PATCH: update plan
// -----------------------------------------------------------------------------

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();
    const auditCtx = extractAuditContext(req);
    requireAdmin(user.role);

    if (!canManagePlans(user.role)) {
      await logAdminAction({
        actor: user,
        action: AdminActionType.PLAN_EDIT,
        outcome: "BLOCKED",
        errorMessage: "Only site owners can edit plans.",
        context: auditCtx,
      });
      return NextResponse.json({ error: "Only site owners can edit plans." }, { status: 403 });
    }

    const parsed = await parseBody(req, updatePlanSchema);
    if (!parsed.success) return parsed.response;
    const { id, ...fields } = parsed.data;

    const existing = await prisma.plan.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Plan not found." }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (fields.name !== undefined) updateData.name = fields.name;
    if (fields.monthlyTokens !== undefined) updateData.monthlyTokens = fields.monthlyTokens;
    if (fields.priceCents !== undefined) updateData.priceCents = fields.priceCents ?? 0;
    if (fields.isActive !== undefined) updateData.isActive = fields.isActive;
    if (fields.isRecurring !== undefined) updateData.isRecurring = fields.isRecurring;
    if (fields.stripeProductId !== undefined) updateData.stripeProductId = fields.stripeProductId;
    if (fields.stripePriceId !== undefined) updateData.stripePriceId = fields.stripePriceId;
    // Display copy. `features` arrives as string[] | null after Zod's
    // newline-separated transform; nullable Json column stores both
    // shapes correctly.
    if (fields.tagline !== undefined) updateData.tagline = fields.tagline;
    if (fields.features !== undefined) {
      // Json column needs Prisma.DbNull for SQL NULL — see POST handler.
      updateData.features = fields.features ?? Prisma.DbNull;
    }
    if (fields.displayCtaLabel !== undefined) updateData.displayCtaLabel = fields.displayCtaLabel;
    if (fields.displaySubtitle !== undefined) updateData.displaySubtitle = fields.displaySubtitle;
    if (fields.displayOrder !== undefined) updateData.displayOrder = fields.displayOrder;

    const updated = await prisma.plan.update({
      where: { id },
      data: updateData,
    });

    await logAdminAction({
      actor: user,
      action: AdminActionType.PLAN_EDIT,
      outcome: "SUCCESS",
      targetType: "Plan",
      targetId: updated.id,
      // Round-trip through JSON.parse(JSON.stringify(...)) to widen
      // Record<string, unknown> to the Prisma InputJsonValue the log column
      // expects. updateData only holds primitives / nulls here so this is
      // safe and keeps the audit payload readable.
      metadata: JSON.parse(
        JSON.stringify({
          changedFields: Object.keys(updateData),
          before: {
            name: existing.name,
            monthlyTokens: existing.monthlyTokens,
            priceCents: existing.priceCents,
            isActive: existing.isActive,
            isRecurring: existing.isRecurring,
          },
          after: updateData,
        }),
      ),
      context: auditCtx,
    });

    return NextResponse.json(
      {
        id: updated.id,
      },
      { status: 200 },
    );
  } catch (error: any) {
    if (error?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    if (error?.code === "FORBIDDEN") {
      return NextResponse.json({ error: error.message }, { status: error.status ?? 403 });
    }

    console.error("[admin.plans] PATCH error", error);
    return NextResponse.json({ error: "Failed to update plan." }, { status: 500 });
  }
}
