// -----------------------------------------------------------------------------
// @file: app/api/uploads/r2/moodboard-presign/route.ts
// @purpose: Create presigned R2 PUT URL for uploading moodboard assets
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-03-09
// -----------------------------------------------------------------------------

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { createR2Client, getR2BucketName, getR2PublicBaseUrl } from "@/lib/r2";

function sanitizeFilename(name: string): string {
  const base = name.trim().replace(/\s+/g, "_");
  return base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

function makeStorageKey(args: { moodboardId: string; originalName?: string | null }): string {
  const safeName = args.originalName ? sanitizeFilename(args.originalName) : "file";
  const ts = Date.now();
  const rand = crypto.randomUUID().slice(0, 12);

  return `moodboards/${args.moodboardId}/${ts}_${rand}_${safeName}`;
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUserOrThrow();

    if (user.role !== "CUSTOMER") {
      return NextResponse.json(
        { error: "Only customers can upload moodboard assets" },
        { status: 403 },
      );
    }

    if (!user.activeCompanyId) {
      return NextResponse.json({ error: "No active company" }, { status: 400 });
    }

    const body = (await req.json()) as any;

    const moodboardId = body?.moodboardId as string | undefined;
    const contentType = body?.contentType as string | undefined;
    const bytes = body?.bytes as number | undefined;
    const originalName = (body?.originalName as string | undefined) ?? null;

    if (!moodboardId || !contentType || typeof bytes !== "number") {
      return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
    }

    // Verify moodboard belongs to user's company
    const moodboard = await prisma.moodboard.findUnique({
      where: { id: moodboardId },
      select: { id: true, companyId: true },
    });

    if (!moodboard) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    if (moodboard.companyId !== user.activeCompanyId) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    // ----------------------------
    // Presign
    // ----------------------------

    const storageKey = makeStorageKey({ moodboardId, originalName });

    const r2 = createR2Client();
    const bucket = getR2BucketName();

    const cmd = new PutObjectCommand({
      Bucket: bucket,
      Key: storageKey,
      ContentType: contentType,
    });

    const expiresInSeconds = 60 * 5;
    const uploadUrl = await getSignedUrl(r2, cmd, {
      expiresIn: expiresInSeconds,
    });

    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

    // Build public URL server-side (client has no access to R2_PUBLIC_BASE_URL)
    const publicBase = getR2PublicBaseUrl();
    const publicUrl = publicBase ? `${publicBase.replace(/\/$/, "")}/${storageKey}` : null;

    return NextResponse.json({ uploadUrl, storageKey, publicUrl, expiresAt });
  } catch (err: any) {
    const code = err?.code ?? "UNKNOWN";
    if (code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }

    if (code === "MISSING_ENV" || String(err?.message ?? "").startsWith("MISSING_ENV:")) {
      return NextResponse.json(
        { error: "R2_NOT_CONFIGURED", details: String(err?.message ?? "") },
        { status: 500 },
      );
    }

    console.error("[r2/moodboard-presign] unexpected error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
