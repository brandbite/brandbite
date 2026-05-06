// -----------------------------------------------------------------------------
// @file: app/api/uploads/r2/moodboard-presign/route.ts
// @purpose: Server-side file upload for moodboard assets (image/file cards).
//           Receives file via FormData, uploads to R2, returns URL + storageKey.
// @version: v2.0.0
// @status: active
// @lastUpdate: 2026-03-09
// -----------------------------------------------------------------------------

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";

import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { createR2Client, getR2BucketName, getR2PublicBaseUrl, resolveAssetUrl } from "@/lib/r2";
import { MAX_UPLOAD_BYTES } from "@/lib/upload-helpers";

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

// Aligned with Vercel's serverless function body-size cap (~4.5 MB).
// See lib/upload-helpers.ts MAX_UPLOAD_BYTES for the rationale and the
// shared client-server limit constant.
const MAX_FILE_SIZE = MAX_UPLOAD_BYTES;

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

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const moodboardId = formData.get("moodboardId") as string | null;

    if (!file || !moodboardId) {
      return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "FILE_TOO_LARGE", maxBytes: MAX_FILE_SIZE },
        { status: 413 },
      );
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
    // Upload to R2 (server-side)
    // ----------------------------

    const mimeType = file.type || "application/octet-stream";
    const originalName = file.name || null;
    const storageKey = makeStorageKey({ moodboardId, originalName });

    const r2 = createR2Client();
    const bucket = getR2BucketName();
    const buffer = Buffer.from(await file.arrayBuffer());

    await r2.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: storageKey,
        Body: buffer,
        ContentType: mimeType,
      }),
    );

    // ----------------------------
    // Resolve public URL
    // ----------------------------

    const publicUrl = await resolveAssetUrl(storageKey, null);

    return NextResponse.json({
      storageKey,
      url: publicUrl,
      mimeType,
      originalName,
      bytes: file.size,
    });
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

    console.error("[r2/moodboard-upload] unexpected error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
