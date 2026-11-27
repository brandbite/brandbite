// -----------------------------------------------------------------------------
// @file: app/api/tools/newsletter-image/route.ts
// @purpose: Starts the upload of a picture for a newsletter. Answers with a
//           link the browser PUTs the file to (straight to storage) and the
//           public address to put in the email. For customers on a plan only;
//           needs the public asset domain, because an email can't show a
//           picture from an address that expires.
// -----------------------------------------------------------------------------

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { ListObjectsV2Command, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse, type NextRequest } from "next/server";

import {
  NEWSLETTER_IMAGE_DAILY_LIMIT,
  NEWSLETTER_LIBRARY_MAX,
  newsletterImageFolder,
  newsletterImageKey,
  newsletterImageProblem,
} from "@/lib/newsletter/images";
import { createR2Client, getR2BucketName, getR2PublicBaseUrl } from "@/lib/r2";
import { rateLimit } from "@/lib/rate-limit";
import { getToolAccess } from "@/lib/tools/entitlement.server";

const UPLOAD_LINK_SECONDS = 5 * 60;

const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

/** The pictures a company uploaded for its newsletters, newest first, for the editor's library. */
export async function GET() {
  const access = await getToolAccess().catch(() => null);
  if (!access?.userId) return fail(401, "Sign in to see your pictures.");
  if (!access.entitlement.pro || !access.companyId) {
    return fail(403, "Image upload is included with a brandbite plan.");
  }
  const base = getR2PublicBaseUrl();
  if (!base) return fail(503, "Image upload isn't set up yet.");
  try {
    // Only this company's own folder is ever listed.
    const listed = await createR2Client().send(
      new ListObjectsV2Command({
        Bucket: getR2BucketName(),
        Prefix: newsletterImageFolder(access.companyId),
        MaxKeys: 1000,
      }),
    );
    const images = (listed.Contents ?? [])
      .filter((item) => item.Key && /\.(png|jpg|gif)$/.test(item.Key))
      .sort((a, b) => (b.LastModified?.getTime() ?? 0) - (a.LastModified?.getTime() ?? 0))
      .slice(0, NEWSLETTER_LIBRARY_MAX)
      .map((item) => ({
        url: `${base.replace(/\/$/, "")}/${item.Key}`,
        bytes: item.Size ?? 0,
        uploadedAt: (item.LastModified ?? new Date(0)).toISOString(),
      }));
    return NextResponse.json({ images });
  } catch (error) {
    if ((error as { code?: string })?.code === "MISSING_ENV") {
      return fail(503, "Image upload isn't set up yet.");
    }
    console.error("[tools/newsletter-image] list failed", error);
    return fail(500, "Your pictures couldn't be loaded.");
  }
}

export async function POST(req: NextRequest) {
  const access = await getToolAccess().catch(() => null);
  if (!access?.userId) return fail(401, "Sign in to upload an image.");
  if (!access.entitlement.pro || !access.companyId) {
    return fail(403, "Image upload is included with a brandbite plan.");
  }
  const base = getR2PublicBaseUrl();
  if (!base) return fail(503, "Image upload isn't set up yet. Paste the image's address instead.");

  const body = (await req.json().catch(() => null)) as {
    contentType?: unknown;
    sizeBytes?: unknown;
  } | null;
  const contentType = typeof body?.contentType === "string" ? body.contentType : "";
  const sizeBytes =
    typeof body?.sizeBytes === "number" && Number.isInteger(body.sizeBytes) ? body.sizeBytes : 0;
  const problem = newsletterImageProblem({ type: contentType, size: sizeBytes });
  if (problem) return fail(400, problem);

  const limit = await rateLimit(`newsletter-image:${access.companyId}`, {
    limit: NEWSLETTER_IMAGE_DAILY_LIMIT,
    windowSeconds: 86400,
  });
  if (!limit.allowed) {
    return fail(429, "Your company has uploaded a lot of images today. Try again tomorrow.");
  }

  try {
    const key = newsletterImageKey(access.companyId, crypto.randomUUID(), contentType);
    const uploadUrl = await getSignedUrl(
      createR2Client(),
      new PutObjectCommand({
        Bucket: getR2BucketName(),
        Key: key,
        ContentType: contentType,
      }),
      { expiresIn: UPLOAD_LINK_SECONDS },
    );
    return NextResponse.json({
      uploadUrl,
      contentType,
      url: `${base.replace(/\/$/, "")}/${key}`,
    });
  } catch (error) {
    if ((error as { code?: string })?.code === "MISSING_ENV") {
      return fail(503, "Image upload isn't set up yet. Paste the image's address instead.");
    }
    console.error("[tools/newsletter-image] failed", error);
    return fail(500, "Could not start the upload.");
  }
}
