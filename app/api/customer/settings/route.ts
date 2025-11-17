// -----------------------------------------------------------------------------
// @file: app/api/customer/settings/route.ts
// @purpose: Customer settings API (account, company, plan & billing status)
// @version: v1.2.0
// @status: active
// @lastUpdate: 2025-11-17
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";

type UserRole = "SITE_OWNER" | "SITE_ADMIN" | "DESIGNER" | "CUSTOMER";
type CompanyRole = "OWNER" | "PM" | "BILLING" | "MEMBER";
type BillingStatus = "ACTIVE" | "PAST_DUE" | "CANCELED";

type CustomerSettingsResponse = {
  user: {
    id: string;
    email: string;
    name: string | null;
    role: UserRole;
    companyRole: CompanyRole | null;
  };
  company: {
    id: string;
    name: string;
    slug: string;
    tokenBalance: number;
    billingStatus: BillingStatus | null;
    createdAt: string;
    updatedAt: string;
    counts: {
      members: number;
      projects: number;
      tickets: number;
    };
  };
  plan: {
    id: string;
    name: string;
    monthlyTokens: number;
    priceCents: number | null;
    isActive: boolean;
  } | null;
};

export async function GET(_req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (user.role !== "CUSTOMER") {
      return NextResponse.json(
        {
          error:
            "You must be a customer to access customer settings.",
        },
        { status: 403 },
      );
    }

    if (!user.activeCompanyId) {
      return NextResponse.json(
        { error: "No active company selected for this user." },
        { status: 400 },
      );
    }

    const company = await prisma.company.findUnique({
      where: { id: user.activeCompanyId },
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

    if (!company) {
      return NextResponse.json(
        {
          error:
            "Active company not found. It may have been deleted.",
        },
        { status: 404 },
      );
    }

    const payload: CustomerSettingsResponse = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name ?? null,
        role: user.role as UserRole,
        companyRole: (user.companyRole ?? null) as CompanyRole | null,
      },
      company: {
        id: company.id,
        name: company.name,
        slug: company.slug,
        tokenBalance: company.tokenBalance,
        billingStatus:
          (company.billingStatus as BillingStatus | null) ?? null,
        createdAt: company.createdAt.toISOString(),
        updatedAt: company.updatedAt.toISOString(),
        counts: {
          members: company._count.members,
          projects: company._count.projects,
          tickets: company._count.tickets,
        },
      },
      plan: company.plan
        ? {
            id: company.plan.id,
            name: company.plan.name,
            monthlyTokens: company.plan.monthlyTokens,
            priceCents: company.plan.priceCents,
            isActive: company.plan.isActive,
          }
        : null,
    };

    return NextResponse.json(payload, { status: 200 });
  } catch (error: any) {
    if (error?.code === "UNAUTHENTICATED") {
      return NextResponse.json(
        { error: "Unauthenticated" },
        { status: 401 },
      );
    }

    console.error("[customer.settings] GET error", error);
    return NextResponse.json(
      { error: "Failed to load customer settings." },
      { status: 500 },
    );
  }
}
