// -----------------------------------------------------------------------------
// @file: app/api/customer/brand/assets/route.ts
// @purpose: Start uploading a file to the brand guide. Returns a presigned R2
//           URL the browser PUTs the file to, so bytes never pass through
//           our servers. The file shows up once /complete has verified it.
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-11-15
// -----------------------------------------------------------------------------

export const runtime = "nodejs";

import { NextResponse, type NextRequest } from "next/server";

import { brandRouteError, customerBrandAccess, editDenied } from "@/lib/brand/brand-access.server";
import {
  BRAND_FILE_MAX_COUNT,
  brandAssetKey,
  brandFileContentType,
  brandFileProblem,
} from "@/lib/brand/brand-files";
import { startBrandAssetSchema } from "@/lib/brand/brand-schema";
import { getOrCreateDefaultBrand } from "@/lib/brand/brand.server";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/schemas/helpers";
import { presignSourceFileUpload } from "@/lib/source-files/r2-source-files";

export async function POST(req: NextRequest) {
  try {
    const access = await customerBrandAccess();
    if (!access.ok) return access.response;
    if (!access.canEdit) return editDenied();

    const parsed = await parseBody(req, startBrandAssetSchema);
    if (!parsed.success) return parsed.response;
    const { name, sizeBytes, kind, background } = parsed.data;

    const problem = brandFileProblem({ name, size: sizeBytes });
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });

    const brand = await getOrCreateDefaultBrand(access.companyId);
    const count = await prisma.brandAsset.count({
      where: { brandId: brand.id, status: "READY", deletedAt: null },
    });
    if (count >= BRAND_FILE_MAX_COUNT) {
      return NextResponse.json(
        { error: `A brand guide can hold up to ${BRAND_FILE_MAX_COUNT} files. Remove one first.` },
        { status: 400 },
      );
    }

    // The type comes from the extension, not the browser.
    const contentType = brandFileContentType(name);
    const asset = await prisma.$transaction(async (tx) => {
      const created = await tx.brandAsset.create({
        data: {
          brandId: brand.id,
          kind,
          background: background ?? "ANY",
          name,
          sizeBytes: BigInt(sizeBytes),
          mimeType: contentType,
          r2Key: "",
          uploadedById: access.userId,
        },
      });
      return tx.brandAsset.update({
        where: { id: created.id },
        data: { r2Key: brandAssetKey(brand.id, created.id, name) },
      });
    });

    return NextResponse.json({
      assetId: asset.id,
      uploadUrl: await presignSourceFileUpload(asset.r2Key, contentType),
      method: "PUT",
      contentType,
    });
  } catch (error) {
    return brandRouteError(error, "asset POST");
  }
}
