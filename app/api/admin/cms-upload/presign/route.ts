// -----------------------------------------------------------------------------
// @file: app/api/admin/cms-upload/presign/route.ts
// @purpose: Create presigned R2 PUT URL for uploading CMS assets (showcase/blog)
// @version: v0.1.0
// @status: active
// @lastUpdate: 2026-02-23
// -----------------------------------------------------------------------------

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { isSiteAdminRole } from "@/lib/roles";
import { createR2Client, getR2BucketName, getR2PublicBaseUrl } from "@/lib/r2";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sanitizeFilename(name: string): string {
  const base = name.trim().replace(/\s+/g, "_");
  return base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

type UploadType = "showcase" | "blog" | "page-block";

function makeStorageKey(type: UploadType, originalName?: string | null): string {
  const safeName = originalName ? sanitizeFilename(originalName) : "file";
  const ts = Date.now();
  const rand = crypto.randomUUID().slice(0, 12);
  return `cms/${type}/${ts}_${rand}_${safeName}`;
}

// ---------------------------------------------------------------------------
// POST — presign a CMS image upload
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  try {
    const user = await getCurrentUserOrThrow();

    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const body = (await req.json()) as any;

    const type = body?.type as UploadType | undefined;
    const contentType = body?.contentType as string | undefined;
    const bytes = body?.bytes as number | undefined;
    const originalName = (body?.originalName as string | undefined) ?? null;

    if (!type || !contentType || typeof bytes !== "number") {
      return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
    }

    if (type !== "showcase" && type !== "blog" && type !== "page-block") {
      return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
    }

    // ----------------------------
    // Presign
    // ----------------------------

    const storageKey = makeStorageKey(type, originalName);

    const r2 = createR2Client();
    const bucket = getR2BucketName();

    const cmd = new PutObjectCommand({
      Bucket: bucket,
      Key: storageKey,
      ContentType: contentType,
    });

    const expiresInSeconds = 60 * 5;
    const uploadUrl = await getSignedUrl(r2, cmd, { expiresIn: expiresInSeconds });

    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

    // Build public URL if R2_PUBLIC_BASE_URL is configured
    const base = getR2PublicBaseUrl();
    const publicUrl = base
      ? `${base.endsWith("/") ? base.slice(0, -1) : base}/${storageKey}`
      : null;

    return NextResponse.json({ uploadUrl, storageKey, publicUrl, expiresAt });
  } catch (err: any) {
    const code = err?.code ?? "UNKNOWN";

    if (code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }

    if (code === "MISSING_ENV" || String(err?.message ?? "").startsWith("MISSING_ENV:")) {
      return NextResponse.json(
        { error: "MISSING_ENV", details: String(err?.message ?? "") },
        { status: 500 },
      );
    }

    console.error("[cms-upload/presign] unexpected error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
