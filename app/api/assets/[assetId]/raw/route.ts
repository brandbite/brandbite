// -----------------------------------------------------------------------------
// @file: app/api/assets/[assetId]/raw/route.ts
// @purpose: Stream an asset's bytes from R2 through our own origin (access-
//           controlled). Used by the in-app PDF viewer/pin overlay: pdf.js
//           fetches the file with fetch(), which is subject to CORS — serving
//           it same-origin avoids any dependency on R2 CORS config and keeps
//           the file behind the same auth as the download route.
// -----------------------------------------------------------------------------

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";

import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { createR2Client, getR2BucketName } from "@/lib/r2";

export async function GET(_req: Request, ctx: { params: Promise<{ assetId: string }> }) {
  try {
    const user = await getCurrentUserOrThrow();
    const { assetId } = await ctx.params;

    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      select: {
        id: true,
        storageKey: true,
        mimeType: true,
        deletedAt: true,
        ticket: {
          select: {
            companyId: true,
            creativeId: true,
          },
        },
      },
    });

    if (!asset || asset.deletedAt) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    // Same access rules as the download route: company member (customer) or the
    // assigned creative (designer). Site admins fall through to 403 here, matching
    // the download endpoint.
    const companyId = asset.ticket.companyId;
    if (user.role === "CUSTOMER") {
      const membership = await prisma.companyMember.findUnique({
        where: { companyId_userId: { companyId, userId: user.id } },
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
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const r2 = createR2Client();
    const bucket = getR2BucketName();

    const obj = await r2.send(new GetObjectCommand({ Bucket: bucket, Key: asset.storageKey }));

    if (!obj.Body) {
      return NextResponse.json({ error: "EMPTY_OBJECT" }, { status: 502 });
    }

    // AWS SDK v3 stream → web ReadableStream for the Next Response.
    const webStream = (obj.Body as any).transformToWebStream() as ReadableStream;

    const headers: Record<string, string> = {
      "Content-Type": asset.mimeType || obj.ContentType || "application/octet-stream",
      // Inline so the browser/pdf.js renders it in place rather than downloading.
      "Content-Disposition": "inline",
      // Short private cache — the object is immutable per storageKey.
      "Cache-Control": "private, max-age=300",
    };
    if (typeof obj.ContentLength === "number") {
      headers["Content-Length"] = String(obj.ContentLength);
    }

    return new Response(webStream, { status: 200, headers });
  } catch (err: any) {
    if (err?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("[assets/:assetId/raw] error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
