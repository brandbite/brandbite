// -----------------------------------------------------------------------------
// @file: lib/r2.ts
// @purpose: Cloudflare R2 (S3-compatible) client + helpers for presigned URLs
// @version: v0.1.0
// @status: active
// @lastUpdate: 2025-12-27
// -----------------------------------------------------------------------------

import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    const error: Error & { code?: string } = new Error(`MISSING_ENV:${name}`);
    error.code = "MISSING_ENV";
    throw error;
  }
  return v;
}

export function getR2BucketName(): string {
  return requireEnv("R2_BUCKET");
}

export function getR2PublicBaseUrl(): string | null {
  return process.env.R2_PUBLIC_BASE_URL ?? null;
}

export function createR2Client(): S3Client {
  const endpoint = requireEnv("R2_ENDPOINT");
  const region = process.env.R2_REGION ?? "auto";

  const accessKeyId = requireEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = requireEnv("R2_SECRET_ACCESS_KEY");

  return new S3Client({
    region,
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

/**
 * Returns true when the URL looks like a presigned S3/R2 URL
 * (contains X-Amz-Signature or X-Amz-Credential query params).
 * These URLs expire and must be regenerated on every request.
 */
function isPresignedUrl(url: string): boolean {
  return url.includes("X-Amz-Signature=") || url.includes("X-Amz-Credential=");
}

/**
 * Resolve a displayable URL for an asset. Returns the public URL if
 * R2_PUBLIC_BASE_URL is configured, otherwise generates a short-lived
 * presigned download URL. Returns null only when R2 is not configured.
 *
 * NOTE: presigned URLs stored in the DB are always regenerated because
 * they expire after a short TTL.
 */
export async function resolveAssetUrl(
  storageKey: string,
  existingUrl: string | null,
): Promise<string | null> {
  // If it's a stable (non-presigned) URL, return as-is
  if (existingUrl && !isPresignedUrl(existingUrl)) return existingUrl;

  const base = getR2PublicBaseUrl();
  if (base) {
    const trimmed = base.endsWith("/") ? base.slice(0, -1) : base;
    return `${trimmed}/${storageKey}`;
  }

  // Generate a fresh presigned GET URL (valid for 15 minutes)
  try {
    const r2 = createR2Client();
    const bucket = getR2BucketName();
    const cmd = new GetObjectCommand({ Bucket: bucket, Key: storageKey });
    return await getSignedUrl(r2, cmd, { expiresIn: 60 * 15 });
  } catch {
    return null;
  }
}
