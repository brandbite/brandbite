// -----------------------------------------------------------------------------
// @file: app/api/admin/plan-assignment/route.ts
// @purpose: Admin API for assigning subscription plans to companies
// @version: v1.0.0
// @status: active
// @lastUpdate: 2025-11-15
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { AdminActionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { extractAuditContext, logAdminAction } from "@/lib/admin-audit";
import { canAssignCompanyPlan } from "@/lib/roles";
import { hasLiveSubscription } from "@/lib/billing/subscription";
import { parseBody } from "@/lib/schemas/helpers";
import { assignPlanSchema } from "@/lib/schemas/plan-assignment.schemas";

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();
    const auditCtx = extractAuditContext(req);

    if (!canAssignCompanyPlan(user.role)) {
      await logAdminAction({
        actor: user,
        action: AdminActionType.PLAN_ASSIGN,
        outcome: "BLOCKED",
        errorMessage: "Only site owners can assign a plan to a company.",
        context: auditCtx,
      });
      return NextResponse.json(
        { error: "Only site owners can assign a plan to a company." },
        { status: 403 },
      );
    }

    const parsed = await parseBody(req, assignPlanSchema);
    if (!parsed.success) return parsed.response;
    const { companyId, planId } = parsed.data;

    // Validate company exists
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, planId: true, stripeSubscriptionId: true, billingStatus: true },
    });

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    // This only relinks Company.planId — it doesn't touch Stripe. For a
    // company that's subscribed, renewals would then credit the new plan's
    // tokens while Stripe keeps charging the old price (and a later Stripe
    // update can flip the link back). Paying customers change plans through
    // Settings → Switch to a different plan, which updates Stripe with
    // proration.
    if ((planId ?? null) !== company.planId && hasLiveSubscription(company)) {
      const message =
        "This company pays through a Stripe subscription. Change its plan from the customer's Settings → Switch to a different plan, so Stripe bills the new price.";
      await logAdminAction({
        actor: user,
        action: AdminActionType.PLAN_ASSIGN,
        outcome: "BLOCKED",
        targetType: "Company",
        targetId: companyId,
        metadata: { attemptedPlanId: planId ?? null, currentPlanId: company.planId },
        errorMessage: message,
        context: extractAuditContext(req),
      });
      return NextResponse.json({ error: message }, { status: 409 });
    }

    // If planId provided, validate plan exists
    if (planId) {
      const plan = await prisma.plan.findUnique({
        where: { id: planId },
        select: { id: true, isActive: true },
      });

      if (!plan) {
        return NextResponse.json({ error: "Plan not found" }, { status: 404 });
      }
      // The UI only offers active plans; enforce it here too.
      if (!plan.isActive && planId !== company.planId) {
        return NextResponse.json({ error: "Only active plans can be assigned." }, { status: 400 });
      }
    }

    const updated = await prisma.company.update({
      where: { id: companyId },
      data: {
        planId: planId,
      },
      include: {
        plan: true,
        _count: {
          select: {
            members: true,
            projects: true,
            tickets: true,
          },
        },
      },
    });

    await logAdminAction({
      actor: user,
      action: AdminActionType.PLAN_ASSIGN,
      outcome: "SUCCESS",
      targetType: "Company",
      targetId: updated.id,
      metadata: {
        newPlanId: planId ?? null,
        newPlanName: updated.plan?.name ?? null,
      },
      context: auditCtx,
    });

    return NextResponse.json({
      company: {
        id: updated.id,
        name: updated.name,
        slug: updated.slug,
        tokenBalance: updated.tokenBalance,
        plan: updated.plan
          ? {
              id: updated.plan.id,
              name: updated.plan.name,
              monthlyTokens: updated.plan.monthlyTokens,
              priceCents: updated.plan.priceCents,
              isActive: updated.plan.isActive,
            }
          : null,
        counts: {
          members: updated._count.members,
          projects: updated._count.projects,
          tickets: updated._count.tickets,
        },
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (error: any) {
    if ((error as any)?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    console.error("[admin.plan-assignment] PATCH error", error);
    return NextResponse.json({ error: "Failed to assign plan" }, { status: 500 });
  }
}
