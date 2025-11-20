// -----------------------------------------------------------------------------
// @file: app/api/debug/auto-assign/company/[companyId]/route.ts
// @purpose: SiteOwner / SiteAdmin API to update company-level auto-assign default
// @version: v1.1.0
// @status: active
// @lastUpdate: 2025-11-20
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";

type CompanyPatchPayload = {
  autoAssignDefaultEnabled?: boolean;
};

type CompanyPatchResponse = {
  id: string;
  autoAssignDefaultEnabled: boolean;
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ companyId: string }> },
) {
  try {
    const user = await getCurrentUserOrThrow();

    if (user.role !== "SITE_OWNER" && user.role !== "SITE_ADMIN") {
      return NextResponse.json(
        { error: "Only site owners and admins can update this setting." },
        { status: 403 },
      );
    }

    // Next.js 16: params bir Promise, önce await etmeliyiz
    const { companyId } = await params;

    const body = (await req.json().catch(() => null)) as
      | CompanyPatchPayload
      | null;

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }

    if (typeof body.autoAssignDefaultEnabled !== "boolean") {
      return NextResponse.json(
        { error: "autoAssignDefaultEnabled must be a boolean" },
        { status: 400 },
      );
    }

    const updated = await prisma.company.update({
      where: { id: companyId },
      // Prisma tipleri henüz alanı tanımıyorsa data'yı any olarak cast ediyoruz
      data: {
        autoAssignDefaultEnabled: body.autoAssignDefaultEnabled,
      } as any,
    });

    const response: CompanyPatchResponse = {
      id: updated.id,
      autoAssignDefaultEnabled:
        (updated as any).autoAssignDefaultEnabled ?? false,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error: any) {
    if (error?.code === "P2025") {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    if (error?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    console.error("[debug.autoAssign.company] PATCH error", error);
    return NextResponse.json(
      { error: "Failed to update company auto-assign setting" },
      { status: 500 },
    );
  }
}
