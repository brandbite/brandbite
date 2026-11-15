// -----------------------------------------------------------------------------
// @file: app/api/customer/brand-profile/route.ts
// @purpose: How ready the company's brand profile is, for the card on the
//           customer overview. Owner switch: ENGAGEMENT_BRAND_PROFILE.
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { readBrandColors } from "@/lib/brand/brand-data";
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
    const [palettes, moodboards, storage, company, brand] = await Promise.all([
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
      prisma.company.findUnique({ where: { id: companyId }, select: { soundtrackUrl: true } }),
      // The brand guide, if the company has started one.
      prisma.brand.findFirst({
        where: { companyId, isDefault: true },
        select: {
          description: true,
          toneWords: true,
          voiceNotes: true,
          colors: true,
          _count: {
            select: {
              assets: {
                where: {
                  status: "READY",
                  deletedAt: null,
                  kind: { in: ["LOGO_PRIMARY", "LOGO_SECONDARY", "LOGO_ICON", "LOGO_WORDMARK"] },
                },
              },
            },
          },
        },
      }),
    ]);
    const hasLanguage =
      !!brand && (!!brand.description || !!brand.voiceNotes || brand.toneWords.length > 0);

    // The soundtrack step only counts while that feature is switched on.
    const keys: BrandProfileStepKey[] = ["logo", "language", "colors", "moodboard", "storage"];
    if (switches.brandSoundtrack) keys.push("soundtrack");
    return NextResponse.json({
      enabled: true,
      profile: buildBrandProfile(
        {
          logo: (brand?._count.assets ?? 0) > 0,
          language: hasLanguage,
          // Colors in the brand guide count, and so does a saved palette.
          colors: palettes > 0 || readBrandColors(brand?.colors).length > 0,
          moodboard: moodboards > 0,
          storage: storage > 0,
          soundtrack: !!company?.soundtrackUrl,
        },
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
