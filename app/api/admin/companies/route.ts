// -----------------------------------------------------------------------------
// @file: app/api/admin/companies/route.ts
// @purpose: Admin API for companies overview (tokens, plan, counts)
// @version: v1.0.0
// @status: active
// @lastUpdate: 2025-11-15
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { isSiteAdminRole } from "@/lib/roles";

export async function GET(_req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json(
        { error: "Only site admins can access companies overview" },
        { status: 403 },
      );
    }

    const companies = await prisma.company.findMany({
      orderBy: { createdAt: "asc" },
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

    const totalCompanies = companies.length;
    const totalTokenBalance = companies.reduce(
      (sum, c) => sum + (c.tokenBalance ?? 0),
      0,
    );
    const avgTokenBalance =
      totalCompanies > 0 ? totalTokenBalance / totalCompanies : 0;
    const companiesWithPlan = companies.filter((c) => c.planId != null).length;

    const items = companies.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      tokenBalance: c.tokenBalance,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      plan: c.plan
        ? {
            id: c.plan.id,
            name: c.plan.name,
            monthlyTokens: c.plan.monthlyTokens,
            priceCents: c.plan.priceCents,
            isActive: c.plan.isActive,
          }
        : null,
      counts: {
        members: c._count.members,
        projects: c._count.projects,
        tickets: c._count.tickets,
      },
    }));

    return NextResponse.json({
      stats: {
        totalCompanies,
        totalTokenBalance,
        avgTokenBalance,
        companiesWithPlan,
      },
      companies: items,
    });
  } catch (error: any) {
    if ((error as any)?.code === "UNAUTHENTICATED") {
      return NextResponse.json(
        { error: "Unauthenticated" },
        { status: 401 },
      );
    }

    console.error("[admin.companies] GET error", error);
    return NextResponse.json(
      { error: "Failed to load companies overview" },
      { status: 500 },
    );
  }
}
