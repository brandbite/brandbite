// -----------------------------------------------------------------------------
// @file: app/api/tools/brand-logo/route.ts
// @purpose: Hands a signed-in customer's own brand guide logo to the hub tools
//           (Logo pack, Post and ad preview), from our own address so a tool
//           can draw it on a canvas. `?prefer=icon` asks for the icon version
//           first (for avatars); otherwise the primary logo comes first.
//
//           The file is the customer's upload, so it is sent as a download
//           with a locked-down policy: opened directly, an SVG can't run
//           anything on this site.
// -----------------------------------------------------------------------------

import { GetObjectCommand } from "@aws-sdk/client-s3";
import type { BrandAssetKind } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { brandFileContentType, isBrandFilePreviewable } from "@/lib/brand/brand-files";
import { prisma } from "@/lib/prisma";
import { createR2Client, getR2BucketName } from "@/lib/r2";
import { getToolAccess } from "@/lib/tools/entitlement.server";

export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024;
const LOGO_KINDS: BrandAssetKind[] = [
  "LOGO_PRIMARY",
  "LOGO_ICON",
  "LOGO_SECONDARY",
  "LOGO_WORDMARK",
];

function order(prefer: string | null): BrandAssetKind[] {
  return prefer === "icon"
    ? ["LOGO_ICON", "LOGO_PRIMARY", "LOGO_SECONDARY", "LOGO_WORDMARK"]
    : LOGO_KINDS;
}

export async function GET(req: NextRequest) {
  const access = await getToolAccess().catch(() => null);
  if (!access?.userId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!access.companyId) return NextResponse.json({ error: "No logo yet." }, { status: 404 });

  const assets = await prisma.brandAsset.findMany({
    where: {
      brand: { companyId: access.companyId, isDefault: true },
      status: "READY",
      deletedAt: null,
      kind: { in: LOGO_KINDS },
    },
    orderBy: { createdAt: "asc" },
    select: { name: true, kind: true, r2Key: true, sizeBytes: true },
  });
  const usable = assets.filter(
    (asset) => isBrandFilePreviewable(asset.name) && Number(asset.sizeBytes) <= MAX_BYTES,
  );
  const kinds = order(req.nextUrl.searchParams.get("prefer"));
  const logo = kinds.map((kind) => usable.find((asset) => asset.kind === kind)).find(Boolean);
  if (!logo) return NextResponse.json({ error: "No logo yet." }, { status: 404 });

  try {
    const object = await createR2Client().send(
      new GetObjectCommand({ Bucket: getR2BucketName(), Key: logo.r2Key }),
    );
    const bytes = await object.Body?.transformToByteArray();
    if (!bytes) throw new Error("empty file");
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": brandFileContentType(logo.name),
        "Content-Disposition": `attachment; filename="logo.${logo.name.split(".").pop()?.toLowerCase() ?? "png"}"`,
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=300",
        "X-Logo-Name": encodeURIComponent(logo.name),
      },
    });
  } catch (error) {
    console.error("[tools/brand-logo] failed", error);
    return NextResponse.json({ error: "The logo couldn't be read." }, { status: 502 });
  }
}
