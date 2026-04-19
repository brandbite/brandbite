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

// ---------------------------------------------------------------------------
// Presigned URL cache
//
// R2 presigned URLs are stable until their signature expires. We sign them
// for 20 minutes and serve from this per-instance memo for 10 minutes — the
// cached URL is always at least 10 minutes from expiry when handed out.
// Avoids a GetObjectCommand round-trip on every asset listing render.
// ---------------------------------------------------------------------------

type CachedPresignedUrl = { url: string; cachedUntil: number };

const PRESIGNED_URL_VALIDITY_SECONDS = 60 * 20;
const PRESIGNED_CACHE_TTL_MS = 60 * 10 * 1000;

const presignedUrlCache = new Map<string, CachedPresignedUrl>();

// Periodic eviction of expired entries so the map does not grow unbounded
// in long-lived servers. No-op on edge runtimes where setInterval is undefined.
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of presignedUrlCache) {
      if (entry.cachedUntil <= now) presignedUrlCache.delete(key);
    }
  }, 60_000);
}

/**
 * Invalidate the cached presigned URL for a storage key. Call from asset
 * delete / rename paths so clients don't receive a URL pointing at a gone
 * object for up to 10 minutes.
 */
export function invalidatePresignedUrlCache(storageKey: string): void {
  presignedUrlCache.delete(storageKey);
}

/**
 * Resolve a displayable URL for an asset. Returns the public URL if
 * R2_PUBLIC_BASE_URL is configured, otherwise generates (or re-uses a
 * cached) short-lived presigned download URL. Returns null only when R2
 * is not configured.
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

  // Memo hit
  const now = Date.now();
  const cached = presignedUrlCache.get(storageKey);
  if (cached && cached.cachedUntil > now) return cached.url;

  // Generate a fresh presigned GET URL and cache it
  try {
    const r2 = createR2Client();
    const bucket = getR2BucketName();
    const cmd = new GetObjectCommand({ Bucket: bucket, Key: storageKey });
    const url = await getSignedUrl(r2, cmd, { expiresIn: PRESIGNED_URL_VALIDITY_SECONDS });
    presignedUrlCache.set(storageKey, { url, cachedUntil: now + PRESIGNED_CACHE_TTL_MS });
    return url;
  } catch {
    return null;
  }
}
