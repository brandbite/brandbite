// -----------------------------------------------------------------------------
// @file: app/api/customer/brand/route.ts
// @purpose: The company's brand guide. GET returns it with its files for any
//           member (and starts it on first view); PATCH saves edits from
//           owners and project managers.
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-11-15
// -----------------------------------------------------------------------------

export const runtime = "nodejs";

import { NextResponse, type NextRequest } from "next/server";

import { brandRouteError, customerBrandAccess, editDenied } from "@/lib/brand/brand-access.server";
import { updateBrandSchema } from "@/lib/brand/brand-schema";
import { brandView, getOrCreateDefaultBrand, listBrandAssets } from "@/lib/brand/brand.server";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/schemas/helpers";

export async function GET() {
  try {
    const access = await customerBrandAccess();
    if (!access.ok) return access.response;
    const brand = await getOrCreateDefaultBrand(access.companyId);
    return NextResponse.json({
      brand: brandView(brand),
      assets: await listBrandAssets(brand.id),
      canEdit: access.canEdit,
    });
  } catch (error) {
    return brandRouteError(error, "GET");
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const access = await customerBrandAccess();
    if (!access.ok) return access.response;
    if (!access.canEdit) return editDenied();

    const parsed = await parseBody(req, updateBrandSchema);
    if (!parsed.success) return parsed.response;

    const brand = await getOrCreateDefaultBrand(access.companyId);
    // Only the fields that were sent change; the schema leaves the rest undefined.
    const saved = await prisma.brand.update({ where: { id: brand.id }, data: parsed.data });
    return NextResponse.json({ brand: brandView(saved) });
  } catch (error) {
    return brandRouteError(error, "PATCH");
  }
}
