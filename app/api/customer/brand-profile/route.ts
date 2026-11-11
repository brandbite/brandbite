// -----------------------------------------------------------------------------
// @file: app/api/customer/brand-profile/route.ts
// @purpose: How ready the company's brand profile is, for the card on the
//           customer overview. Owner switch: ENGAGEMENT_BRAND_PROFILE.
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { buildBrandProfile, type BrandProfileStepKey } from "@/lib/engagement/brand-profile";
import { getEngagementSwitches } from "@/lib/engagement/switches.server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await getCurrentUserOrThrow();
    if (user.role !== "CUSTOMER" || !user.activeCompanyId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const switches = await getEngagementSwitches();
    if (!switches.brandProfile) return NextResponse.json({ enabled: false });

    const companyId = user.activeCompanyId;
    const [palettes, moodboards, storage] = await Promise.all([
      // A palette saved by anyone on the team counts as the brand's colors.
      prisma.savedPalette.count({
        where: { createdBy: { companies: { some: { companyId } } } },
        take: 1,
      }),
      prisma.moodboard.count({ where: { companyId }, take: 1 }),
      prisma.companyIntegration.count({
        where: { companyId, status: "CONNECTED", provider: { in: ["GOOGLE_DRIVE", "DROPBOX"] } },
        take: 1,
      }),
    ]);

    const keys: BrandProfileStepKey[] = ["colors", "moodboard", "storage"];
    return NextResponse.json({
      enabled: true,
      profile: buildBrandProfile(
        { colors: palettes > 0, moodboard: moodboards > 0, storage: storage > 0 },
        keys,
      ),
    });
  } catch (err: any) {
    if (err?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[brand-profile] GET error", err);
    return NextResponse.json({ error: "Failed to load brand profile" }, { status: 500 });
  }
}
