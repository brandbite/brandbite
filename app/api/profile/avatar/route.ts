// -----------------------------------------------------------------------------
// @file: app/api/profile/avatar/route.ts
// @purpose: Upload + remove the current user's avatar.
//
//           POST   /api/profile/avatar  (multipart/form-data, field "file")
//           DELETE /api/profile/avatar
//
//           Avatars live on AuthUser.image (BetterAuth's built-in column),
//           so the URL is already part of the session response and any
//           future component that reads `session.user.image` will pick it
//           up automatically. Storage is the same Cloudflare R2 bucket
//           ticket assets / moodboards live in, namespaced under
//           `avatars/{authUserId}/`.
//
//           We use a public URL (R2_PUBLIC_BASE_URL) rather than a
//           presigned download URL because:
//             - avatars are referenced from emails, sidebars, comments —
//               anywhere a presigned URL's 20-min expiry would break.
//             - the URL is already public-by-design (anyone signed in can
//               see another user's avatar via tickets / comments).
//             - R2's public URLs can be cached aggressively by CDNs.
//
//           If R2_PUBLIC_BASE_URL isn't set the route refuses with a clear
//           500 — operators must configure the public bucket binding
//           before avatar upload works in that environment.
// -----------------------------------------------------------------------------

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createR2Client, getR2BucketName, getR2PublicBaseUrl } from "@/lib/r2";

const MAX_BYTES = 2 * 1024 * 1024; // 2 MiB
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

function extToType(type: string): string {
  switch (type) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "img";
  }
}

/** Pull the storage key back out of an avatar's public URL so we can
 *  delete the previous object on overwrite / removal. Returns null when
 *  the URL doesn't match our public bucket prefix (e.g. legacy avatars
 *  set via BetterAuth's image field directly). In that case we leave
 *  the old object alone — it's a leak we can sweep later. */
function extractStorageKey(url: string | null): string | null {
  if (!url) return null;
  const base = getR2PublicBaseUrl();
  if (!base) return null;
  const trimmed = base.replace(/\/$/, "");
  if (!url.startsWith(trimmed + "/")) return null;
  return url.slice(trimmed.length + 1);
}

// ---------------------------------------------------------------------------
// POST — upload a new avatar.
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentUserOrThrow();

    const form = await req.formData().catch(() => null);
    if (!form) {
      return NextResponse.json(
        { error: "Expected multipart/form-data with a 'file' field." },
        { status: 400 },
      );
    }
    const fileEntry = form.get("file");
    if (!(fileEntry instanceof File)) {
      return NextResponse.json({ error: "file field is required." }, { status: 400 });
    }

    if (!ALLOWED_TYPES.has(fileEntry.type)) {
      return NextResponse.json(
        { error: "Unsupported image type. Use PNG, JPEG, WebP, or GIF." },
        { status: 400 },
      );
    }
    if (fileEntry.size === 0) {
      return NextResponse.json({ error: "Empty file." }, { status: 400 });
    }
    if (fileEntry.size > MAX_BYTES) {
      return NextResponse.json({ error: "Image must be 2 MB or smaller." }, { status: 413 });
    }

    const userAccount = await prisma.userAccount.findUnique({
      where: { id: session.id },
      select: { authUserId: true },
    });
    if (!userAccount) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }

    const publicBase = getR2PublicBaseUrl();
    if (!publicBase) {
      return NextResponse.json(
        {
          error: "Avatar upload is not configured for this environment. Set R2_PUBLIC_BASE_URL.",
        },
        { status: 500 },
      );
    }

    const r2 = createR2Client();
    const bucket = getR2BucketName();
    const storageKey = `avatars/${userAccount.authUserId}/${Date.now()}.${extToType(fileEntry.type)}`;
    const buffer = Buffer.from(await fileEntry.arrayBuffer());

    await r2.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: storageKey,
        Body: buffer,
        ContentType: fileEntry.type,
        // Long-cache: avatar URLs change on every upload (timestamp in
        // the key) so a long max-age is safe and pushes load off our
        // origin onto the CDN.
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );

    const url = `${publicBase.replace(/\/$/, "")}/${storageKey}`;

    // Snapshot the previous image so we can clean up the old R2 object
    // after the DB update commits.
    const previous = await prisma.authUser.findUnique({
      where: { id: userAccount.authUserId },
      select: { image: true },
    });

    await prisma.authUser.update({
      where: { id: userAccount.authUserId },
      data: { image: url },
    });

    if (previous?.image && previous.image !== url) {
      const oldKey = extractStorageKey(previous.image);
      if (oldKey) {
        try {
          await r2.send(new DeleteObjectCommand({ Bucket: bucket, Key: oldKey }));
        } catch (err) {
          // Non-fatal — leaves an orphaned object in R2 but the user's
          // avatar is correctly updated. Log so ops can sweep later.
          console.warn("[avatar] failed to delete old object", err);
        }
      }
    }

    return NextResponse.json({ user: { image: url } });
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    if ((err as { code?: string })?.code === "MISSING_ENV") {
      return NextResponse.json(
        { error: "Avatar upload is not configured for this environment." },
        { status: 500 },
      );
    }
    console.error("[POST /api/profile/avatar] error", err);
    return NextResponse.json({ error: "Failed to upload avatar." }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE — remove the current avatar.
// ---------------------------------------------------------------------------

export async function DELETE() {
  try {
    const session = await getCurrentUserOrThrow();

    const userAccount = await prisma.userAccount.findUnique({
      where: { id: session.id },
      select: { authUserId: true },
    });
    if (!userAccount) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }

    const auth = await prisma.authUser.findUnique({
      where: { id: userAccount.authUserId },
      select: { image: true },
    });

    if (!auth?.image) {
      // Nothing to remove. Treat as success rather than 404 — UX-wise
      // the user wanted "no avatar" and that's already the state.
      return NextResponse.json({ user: { image: null } });
    }

    await prisma.authUser.update({
      where: { id: userAccount.authUserId },
      data: { image: null },
    });

    const oldKey = extractStorageKey(auth.image);
    if (oldKey) {
      try {
        const r2 = createR2Client();
        await r2.send(new DeleteObjectCommand({ Bucket: getR2BucketName(), Key: oldKey }));
      } catch (err) {
        console.warn("[avatar] failed to delete object on remove", err);
      }
    }

    return NextResponse.json({ user: { image: null } });
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[DELETE /api/profile/avatar] error", err);
    return NextResponse.json({ error: "Failed to remove avatar." }, { status: 500 });
  }
}
