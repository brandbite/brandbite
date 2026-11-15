// -----------------------------------------------------------------------------
// @file: app/api/customer/brand/assets/[assetId]/route.ts
// @purpose: Change what a brand file is (kind, background, note) or remove
//           it. Owners and project managers only.
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-11-15
// -----------------------------------------------------------------------------

export const runtime = "nodejs";

import { NextResponse, type NextRequest } from "next/server";

import { brandRouteError, customerBrandAccess, editDenied } from "@/lib/brand/brand-access.server";
import { updateBrandAssetSchema } from "@/lib/brand/brand-schema";
import { brandAssetView } from "@/lib/brand/brand.server";
import { prisma } from "@/lib/prisma";
import { deleteR2Objects } from "@/lib/r2";
import { parseBody } from "@/lib/schemas/helpers";

type Params = { params: Promise<{ assetId: string }> };

async function findAsset(assetId: string, companyId: string) {
  return prisma.brandAsset.findFirst({
    where: { id: assetId, deletedAt: null, brand: { companyId } },
  });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const access = await customerBrandAccess();
    if (!access.ok) return access.response;
    if (!access.canEdit) return editDenied();

    const asset = await findAsset((await params).assetId, access.companyId);
    if (!asset) return NextResponse.json({ error: "File not found." }, { status: 404 });

    const parsed = await parseBody(req, updateBrandAssetSchema);
    if (!parsed.success) return parsed.response;

    const saved = await prisma.brandAsset.update({ where: { id: asset.id }, data: parsed.data });
    return NextResponse.json({ asset: await brandAssetView(saved) });
  } catch (error) {
    return brandRouteError(error, "asset PATCH");
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const access = await customerBrandAccess();
    if (!access.ok) return access.response;
    if (!access.canEdit) return editDenied();

    const asset = await findAsset((await params).assetId, access.companyId);
    if (!asset) return NextResponse.json({ error: "File not found." }, { status: 404 });

    await prisma.brandAsset.update({ where: { id: asset.id }, data: { deletedAt: new Date() } });
    await deleteR2Objects([asset.r2Key]);
    return NextResponse.json({ success: true });
  } catch (error) {
    return brandRouteError(error, "asset DELETE");
  }
}
