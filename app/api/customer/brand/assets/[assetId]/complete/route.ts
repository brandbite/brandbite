// -----------------------------------------------------------------------------
// @file: app/api/customer/brand/assets/[assetId]/complete/route.ts
// @purpose: The browser finished its PUT. Check with R2 that the file is
//           really there at the size that was announced before showing it.
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-11-15
// -----------------------------------------------------------------------------

export const runtime = "nodejs";

import { NextResponse, type NextRequest } from "next/server";

import { brandRouteError, customerBrandAccess, editDenied } from "@/lib/brand/brand-access.server";
import { brandAssetView } from "@/lib/brand/brand.server";
import { prisma } from "@/lib/prisma";
import { deleteR2Objects } from "@/lib/r2";
import { sourceFileObjectSize } from "@/lib/source-files/r2-source-files";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ assetId: string }> },
) {
  try {
    const access = await customerBrandAccess();
    if (!access.ok) return access.response;
    if (!access.canEdit) return editDenied();

    const { assetId } = await params;
    const asset = await prisma.brandAsset.findFirst({
      where: { id: assetId, deletedAt: null, brand: { companyId: access.companyId } },
    });
    if (!asset) return NextResponse.json({ error: "Upload not found." }, { status: 404 });
    if (asset.status === "READY") {
      return NextResponse.json({ asset: await brandAssetView(asset) });
    }

    // A presigned PUT can't cap the size, so a file that isn't exactly what
    // was announced (and checked against the limit) is thrown away.
    const stored = await sourceFileObjectSize(asset.r2Key);
    if (stored === null || stored !== Number(asset.sizeBytes)) {
      await prisma.brandAsset.update({ where: { id: asset.id }, data: { status: "FAILED" } });
      await deleteR2Objects([asset.r2Key]);
      return NextResponse.json(
        { error: "The file didn't arrive complete. Please upload it again." },
        { status: 422 },
      );
    }

    const saved = await prisma.brandAsset.update({
      where: { id: asset.id },
      data: { status: "READY" },
    });
    return NextResponse.json({ asset: await brandAssetView(saved) });
  } catch (error) {
    return brandRouteError(error, "asset complete");
  }
}
