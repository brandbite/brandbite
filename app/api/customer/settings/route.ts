// -----------------------------------------------------------------------------
// @file: app/api/customer/settings/route.ts
// @purpose: Customer settings API (account, company, plan & billing status)
// @version: v1.3.0
// @status: active
// @lastUpdate: 2025-12-18
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import {
  normalizeCompanyRole,
  canEditCompanyProfile,
} from "@/lib/permissions/companyRoles";

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
    website: string | null;
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
        website: company.website ?? null,
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

// ---------------------------------------------------------------------------
// PATCH — Update user profile and/or company profile
// Body: { user?: { name?: string }, company?: { name?: string, website?: string | null } }
// ---------------------------------------------------------------------------

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (user.role !== "CUSTOMER") {
      return NextResponse.json(
        { error: "Only customers can update settings." },
        { status: 403 },
      );
    }

    if (!user.activeCompanyId) {
      return NextResponse.json(
        { error: "No active company selected." },
        { status: 400 },
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Request body is required." },
        { status: 400 },
      );
    }

    const updates: { userUpdated: boolean; companyUpdated: boolean } = {
      userUpdated: false,
      companyUpdated: false,
    };

    // --- User profile update (any customer can edit their own name) ---
    if (body.user && typeof body.user === "object") {
      const userName = body.user.name;
      if (userName !== undefined) {
        const trimmed =
          typeof userName === "string" ? userName.trim() : null;
        if (trimmed !== null && trimmed.length < 1) {
          return NextResponse.json(
            { error: "User name cannot be empty." },
            { status: 400 },
          );
        }
        await prisma.userAccount.update({
          where: { id: user.id },
          data: { name: trimmed || null },
        });
        updates.userUpdated = true;
      }
    }

    // --- Company profile update (OWNER + PM only) ---
    if (body.company && typeof body.company === "object") {
      const companyRole = normalizeCompanyRole(user.companyRole);
      if (!canEditCompanyProfile(companyRole)) {
        return NextResponse.json(
          {
            error:
              "Only company owners or project managers can edit company profile.",
          },
          { status: 403 },
        );
      }

      const companyData: Record<string, unknown> = {};

      if (body.company.name !== undefined) {
        const companyName =
          typeof body.company.name === "string"
            ? body.company.name.trim()
            : "";
        if (companyName.length < 2) {
          return NextResponse.json(
            { error: "Company name must be at least 2 characters." },
            { status: 400 },
          );
        }
        companyData.name = companyName;
      }

      if (body.company.website !== undefined) {
        const website =
          typeof body.company.website === "string"
            ? body.company.website.trim()
            : null;
        // Allow clearing the website (null/empty)
        companyData.website = website || null;
      }

      if (Object.keys(companyData).length > 0) {
        await prisma.company.update({
          where: { id: user.activeCompanyId },
          data: companyData,
        });
        updates.companyUpdated = true;
      }
    }

    return NextResponse.json({ ok: true, ...updates });
  } catch (error: any) {
    if (error?.code === "UNAUTHENTICATED") {
      return NextResponse.json(
        { error: "Unauthenticated" },
        { status: 401 },
      );
    }

    console.error("[customer.settings] PATCH error", error);
    return NextResponse.json(
      { error: "Failed to update settings." },
      { status: 500 },
    );
  }
}
