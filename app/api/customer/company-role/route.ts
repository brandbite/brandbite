// -----------------------------------------------------------------------------
// @file: app/api/customer/company-role/route.ts
// @purpose: Return the current customer's role in their active company
// @version: v1.0.0
// @status: active
// @lastUpdate: 2025-11-26
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";

type CompanyRoleResponse = {
  role: string | null;
};

export async function GET(_req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    // This endpoint is only meant for the CUSTOMER persona.
    if (user.role !== "CUSTOMER") {
      return NextResponse.json(
        { error: "Only customers can access this endpoint." },
        { status: 403 },
      );
    }

    const activeCompanyId = user.activeCompanyId;

    // No active company → no role. The board UI renders this as "Not set".
    if (!activeCompanyId) {
      const response: CompanyRoleResponse = {
        role: null,
      };
      return NextResponse.json(response, { status: 200 });
    }

    const membership = await prisma.companyMember.findFirst({
      where: {
        companyId: activeCompanyId,
        userId: user.id,
      },
      select: {
        roleInCompany: true,
      },
    });

    const response: CompanyRoleResponse = {
      // Prisma enum surfaced as a string: "OWNER" | "PM" | "BILLING" | "MEMBER" | null
      role: membership?.roleInCompany ?? null,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error: any) {
    if (error?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    console.error("[customer.company-role] GET error", error);
    return NextResponse.json({ error: "Failed to load company role" }, { status: 500 });
  }
}
