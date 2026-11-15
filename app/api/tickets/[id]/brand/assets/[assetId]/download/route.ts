// -----------------------------------------------------------------------------
// @file: app/api/tickets/[id]/brand/assets/[assetId]/download/route.ts
// @purpose: A short-lived link that downloads a brand file as an attachment,
//           for anyone who can see the request the brand guide belongs to.
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-11-15
// -----------------------------------------------------------------------------

export const runtime = "nodejs";

import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { brandRouteError } from "@/lib/brand/brand-access.server";
import { brandForProject } from "@/lib/brand/brand.server";
import { prisma } from "@/lib/prisma";
import { presignSourceFileDownload } from "@/lib/source-files/r2-source-files";
import { canViewSourceFiles, loadSourceFileTicket } from "@/lib/source-files/source-files";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; assetId: string }> },
) {
  try {
    const user = await getCurrentUserOrThrow();
    const { id, assetId } = await params;
    const ticket = await loadSourceFileTicket(id);
    if (!ticket || !(await canViewSourceFiles(user, ticket))) {
      return NextResponse.json({ error: "Request not found." }, { status: 404 });
    }
    // Only files of the brand this request uses, never another brand's.
    const { brand } = await brandForProject({
      companyId: ticket.companyId,
      projectId: ticket.project?.id,
    });
    const asset = await prisma.brandAsset.findFirst({
      where: { id: assetId, brandId: brand.id, status: "READY", deletedAt: null },
      select: { r2Key: true, name: true },
    });
    if (!asset) return NextResponse.json({ error: "File not found." }, { status: 404 });

    return NextResponse.json({ url: await presignSourceFileDownload(asset.r2Key, asset.name) });
  } catch (error) {
    return brandRouteError(error, "ticket brand download");
  }
}
