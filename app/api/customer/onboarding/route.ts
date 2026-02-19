// -----------------------------------------------------------------------------
// @file: app/api/customer/onboarding/route.ts
// @purpose: Customer self-service onboarding — create company + mark complete
// @version: v1.0.0
// @status: active
// @lastUpdate: 2025-12-15
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";

// ---------------------------------------------------------------------------
// POST — Create a new company and make the current user the OWNER
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (user.role !== "CUSTOMER") {
      return NextResponse.json(
        { error: "Only customers can create companies." },
        { status: 403 },
      );
    }

    // Check if user already belongs to a company
    if (user.activeCompanyId) {
      return NextResponse.json(
        { error: "You are already a member of a company." },
        { status: 400 },
      );
    }

    const body = await req.json().catch(() => null);
    const name = (body?.name as string)?.trim();
    const website = (body?.website as string)?.trim() || null;

    if (!name || name.length < 2) {
      return NextResponse.json(
        { error: "Company name is required (min 2 characters)." },
        { status: 400 },
      );
    }

    // Generate slug from name
    let baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    if (!baseSlug) baseSlug = "company";

    // Ensure uniqueness
    let slug = baseSlug;
    let suffix = 0;
    while (await prisma.company.findUnique({ where: { slug } })) {
      suffix += 1;
      slug = `${baseSlug}-${suffix}`;
    }

    // Create company + make user the OWNER in a transaction
    const company = await prisma.$transaction(async (tx) => {
      const newCompany = await tx.company.create({
        data: {
          name,
          slug,
          website,
          autoAssignDefaultEnabled: false,
          tokenBalance: 0,
        },
      });

      await tx.companyMember.create({
        data: {
          companyId: newCompany.id,
          userId: user.id,
          roleInCompany: "OWNER",
        },
      });

      return newCompany;
    });

    return NextResponse.json({
      success: true,
      company: {
        id: company.id,
        name: company.name,
        slug: company.slug,
      },
    });
  } catch (err: any) {
    console.error("[Onboarding] POST error:", err);

    if (err?.code === "UNAUTHENTICATED") {
      return NextResponse.json(
        { error: "Not authenticated." },
        { status: 401 },
      );
    }

    return NextResponse.json(
      { error: "Failed to create company." },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// PATCH — Mark onboarding as complete (stamps onboardingCompletedAt)
// ---------------------------------------------------------------------------

export async function PATCH() {
  try {
    const user = await getCurrentUserOrThrow();

    if (!user.activeCompanyId) {
      return NextResponse.json(
        { error: "No active company found." },
        { status: 400 },
      );
    }

    await prisma.company.update({
      where: { id: user.activeCompanyId },
      data: { onboardingCompletedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[Onboarding] PATCH error:", err);

    if (err?.code === "UNAUTHENTICATED") {
      return NextResponse.json(
        { error: "Not authenticated." },
        { status: 401 },
      );
    }

    return NextResponse.json(
      { error: "Failed to complete onboarding." },
      { status: 500 },
    );
  }
}
