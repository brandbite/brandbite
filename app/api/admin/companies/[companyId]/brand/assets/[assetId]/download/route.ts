// -----------------------------------------------------------------------------
// @file: app/api/admin/companies/[companyId]/brand/assets/[assetId]/download/route.ts
// @purpose: A short-lived link that downloads one of a company's brand files
//           as an attachment, for site admins.
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-11-15
// -----------------------------------------------------------------------------

export const runtime = "nodejs";

import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { brandRouteError } from "@/lib/brand/brand-access.server";
import { prisma } from "@/lib/prisma";
import { isSiteAdminRole } from "@/lib/roles";
import { presignSourceFileDownload } from "@/lib/source-files/r2-source-files";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ companyId: string; assetId: string }> },
) {
  try {
    const user = await getCurrentUserOrThrow();
    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { companyId, assetId } = await params;
    const asset = await prisma.brandAsset.findFirst({
      where: { id: assetId, status: "READY", deletedAt: null, brand: { companyId } },
      select: { r2Key: true, name: true },
    });
    if (!asset) return NextResponse.json({ error: "File not found." }, { status: 404 });

    return NextResponse.json({ url: await presignSourceFileDownload(asset.r2Key, asset.name) });
  } catch (error) {
    return brandRouteError(error, "admin brand download");
  }
}
