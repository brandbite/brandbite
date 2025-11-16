// -----------------------------------------------------------------------------
// @file: app/api/customer/settings/route.ts
// @purpose: Customer API for account, company and plan overview
// @version: v1.1.0
// @status: active
// @lastUpdate: 2025-11-16
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";

export async function GET(_req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    // Şimdilik sadece CUSTOMER rolü için açıyoruz
    if (user.role !== "CUSTOMER") {
      return NextResponse.json(
        { error: "Only customers can access this endpoint" },
        { status: 403 },
      );
    }

    const membership = await prisma.companyMember.findFirst({
      where: { userId: user.id },
      include: {
        company: {
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
        },
      },
    });

    if (!membership || !membership.company) {
      return NextResponse.json(
        { error: "No company found for this customer" },
        { status: 404 },
      );
    }

    const company = membership.company;
    const plan = company.plan;

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        // IMPORTANT: expose company role for customer settings UI
        companyRole: membership.roleInCompany,
      },
      company: {
        id: company.id,
        name: company.name,
        slug: company.slug,
        tokenBalance: company.tokenBalance,
        createdAt: company.createdAt.toISOString(),
        updatedAt: company.updatedAt.toISOString(),
        counts: {
          members: company._count.members,
          projects: company._count.projects,
          tickets: company._count.tickets,
        },
      },
      plan: plan
        ? {
            id: plan.id,
            name: plan.name,
            monthlyTokens: plan.monthlyTokens,
            priceCents: plan.priceCents,
            isActive: plan.isActive,
          }
        : null,
    });
  } catch (error: any) {
    if ((error as any)?.code === "UNAUTHENTICATED") {
      return NextResponse.json(
        { error: "Unauthenticated" },
        { status: 401 },
      );
    }

    console.error("[customer.settings] GET error", error);
    return NextResponse.json(
      { error: "Failed to load customer settings" },
      { status: 500 },
    );
  }
}
