// -----------------------------------------------------------------------------
// @file: app/api/customer/brand/assets/[assetId]/download/route.ts
// @purpose: A short-lived link that downloads a brand file straight from R2,
//           always as an attachment, for any member of the company.
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-11-15
// -----------------------------------------------------------------------------

export const runtime = "nodejs";

import { NextResponse, type NextRequest } from "next/server";

import { brandRouteError, customerBrandAccess } from "@/lib/brand/brand-access.server";
import { prisma } from "@/lib/prisma";
import { presignSourceFileDownload } from "@/lib/source-files/r2-source-files";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ assetId: string }> }) {
  try {
    const access = await customerBrandAccess();
    if (!access.ok) return access.response;

    const { assetId } = await params;
    const asset = await prisma.brandAsset.findFirst({
      where: {
        id: assetId,
        status: "READY",
        deletedAt: null,
        brand: { companyId: access.companyId },
      },
      select: { r2Key: true, name: true },
    });
    if (!asset) return NextResponse.json({ error: "File not found." }, { status: 404 });

    return NextResponse.json({ url: await presignSourceFileDownload(asset.r2Key, asset.name) });
  } catch (error) {
    return brandRouteError(error, "asset download");
  }
}
