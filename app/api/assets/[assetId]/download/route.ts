// -----------------------------------------------------------------------------
// @file: app/api/assets/[assetId]/download/route.ts
// @purpose: Create presigned R2 GET URL for a stored asset (access-controlled)
// @version: v0.1.0
// @status: active
// @lastUpdate: 2025-12-27
// -----------------------------------------------------------------------------

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { createR2Client, getR2BucketName } from "@/lib/r2";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ assetId: string }> },
) {
  try {
    const user = await getCurrentUserOrThrow();
    const { assetId } = await ctx.params;

    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      select: {
        id: true,
        storageKey: true,
        ticketId: true,
        deletedAt: true,
        ticket: {
          select: {
            companyId: true,
            createdById: true,
            creativeId: true,
          },
        },
      },
    });

    if (!asset || asset.deletedAt) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    // Access check: must belong to same company member OR assigned creative
    const companyId = asset.ticket.companyId;

    if (user.role === "CUSTOMER") {
      const membership = await prisma.companyMember.findUnique({
        where: {
          companyId_userId: { companyId, userId: user.id },
        },
        select: { id: true },
      });

      if (!membership) {
        return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
      }
    } else if (user.role === "DESIGNER") {
      if (!asset.ticket.creativeId || asset.ticket.creativeId !== user.id) {
        return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
      }
    } else {
      // Site admins can be added later if needed
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const r2 = createR2Client();
    const bucket = getR2BucketName();

    const cmd = new GetObjectCommand({
      Bucket: bucket,
      Key: asset.storageKey,
    });

    const expiresInSeconds = 60 * 5;
    const downloadUrl = await getSignedUrl(r2, cmd, {
      expiresIn: expiresInSeconds,
    });

    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

    return NextResponse.json({ downloadUrl, expiresAt });
  } catch (err: any) {
    const code = err?.code ?? "UNKNOWN";
    if (code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("[assets/:assetId/download] error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
