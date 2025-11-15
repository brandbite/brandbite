// -----------------------------------------------------------------------------
// @file: app/api/customer/members/route.ts
// @purpose: Customer API for viewing company members & roles
// @version: v1.0.0
// @status: active
// @lastUpdate: 2025-11-16
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { CompanyRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";

const ALLOWED_COMPANY_ROLES: CompanyRole[] = ["OWNER", "PM"];

export async function GET(_req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (user.role !== "CUSTOMER") {
      return NextResponse.json(
        { error: "Only customers can access company members" },
        { status: 403 },
      );
    }

    if (!user.activeCompanyId) {
      return NextResponse.json(
        { error: "User has no active company" },
        { status: 400 },
      );
    }

    if (!user.companyRole || !ALLOWED_COMPANY_ROLES.includes(user.companyRole)) {
      return NextResponse.json(
        {
          error:
            "Only company owners or project managers can access company members",
        },
        { status: 403 },
      );
    }

    const company = await prisma.company.findUnique({
      where: { id: user.activeCompanyId },
      include: {
        members: {
          include: {
            user: true,
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    if (!company) {
      return NextResponse.json(
        { error: "Company not found for current user" },
        { status: 404 },
      );
    }

    const members = company.members.map((m) => ({
      id: m.id,
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      roleInCompany: m.roleInCompany,
      joinedAt: m.createdAt.toISOString(),
    }));

    return NextResponse.json(
      {
        company: {
          id: company.id,
          name: company.name,
          slug: company.slug,
        },
        currentUserId: user.id,
        members,
      },
      { status: 200 },
    );
  } catch (error: any) {
    if ((error as any)?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    console.error("[customer.members] GET error", error);
    return NextResponse.json(
      { error: "Failed to load company members" },
      { status: 500 },
    );
  }
}
