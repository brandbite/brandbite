// -----------------------------------------------------------------------------
// @file: app/api/admin/companies/[companyId]/brand/route.ts
// @purpose: A company's brand guide, read-only, for site admins. Returns
//           nothing to build on when the company hasn't started one, so
//           looking never creates a guide.
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-11-15
// -----------------------------------------------------------------------------

export const runtime = "nodejs";

import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { brandRouteError } from "@/lib/brand/brand-access.server";
import { brandView, listBrandAssets } from "@/lib/brand/brand.server";
import { prisma } from "@/lib/prisma";
import { isSiteAdminRole } from "@/lib/roles";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ companyId: string }> },
) {
  try {
    const user = await getCurrentUserOrThrow();
    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { companyId } = await params;
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true },
    });
    if (!company) return NextResponse.json({ error: "Company not found." }, { status: 404 });

    const brand = await prisma.brand.findFirst({ where: { companyId, isDefault: true } });
    if (!brand) {
      // Same shape as an empty guide, so the page says it isn't filled in.
      return NextResponse.json({
        brand: {
          name: company.name,
          tagline: null,
          description: null,
          audience: null,
          values: [],
          references: null,
          toneWords: [],
          voiceNotes: null,
          voiceDo: [],
          voiceDont: [],
          wordsToUse: [],
          wordsToAvoid: [],
          sampleCopy: null,
          colors: [],
          fonts: [],
          imageryNotes: null,
        },
        assets: [],
        logoLink: null,
      });
    }
    return NextResponse.json({
      brand: brandView(brand),
      assets: await listBrandAssets(brand.id),
      logoLink: null,
    });
  } catch (error) {
    return brandRouteError(error, "admin brand GET");
  }
}
