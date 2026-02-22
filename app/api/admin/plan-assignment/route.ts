// -----------------------------------------------------------------------------
// @file: app/api/admin/plan-assignment/route.ts
// @purpose: Admin API for assigning subscription plans to companies
// @version: v1.0.0
// @status: active
// @lastUpdate: 2025-11-15
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { isSiteAdminRole } from "@/lib/roles";
import { parseBody } from "@/lib/schemas/helpers";
import { assignPlanSchema } from "@/lib/schemas/plan-assignment.schemas";

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json({ error: "Only site admins can assign plans" }, { status: 403 });
    }

    const parsed = await parseBody(req, assignPlanSchema);
    if (!parsed.success) return parsed.response;
    const { companyId, planId } = parsed.data;

    // Validate company exists
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    });

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
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
      // İstersen burada aktif olmayan plana atamayı da engelleyebiliriz;
      // şimdilik sadece var olması yeterli.
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
