// -----------------------------------------------------------------------------
// @file: lib/r2.ts
// @purpose: Cloudflare R2 (S3-compatible) client + helpers for presigned URLs
// @version: v0.1.0
// @status: active
// @lastUpdate: 2025-12-27
// -----------------------------------------------------------------------------

import { S3Client, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
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

/**
 * Returns the configured public base URL, but ONLY when it looks like
 * an absolute http(s) URL. A misconfigured env (empty string, literal
 * "undefined", ".", "/", a hostname without scheme, etc.) is treated
 * as unset — otherwise we'd happily concatenate `${"."} + "/" + storageKey`
 * and ship `./tickets/<id>/brief/foo.png` to the browser, which then
 * resolves it relative to the current page URL and produces the broken
 * `/admin/tickets/<id>/tickets/<id>/brief/foo.png` request we keep
 * debugging.
 */
export function getR2PublicBaseUrl(): string | null {
  const raw = process.env.R2_PUBLIC_BASE_URL;
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  return trimmed;
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
 * Best-effort deletion of R2 objects by storage key. Never throws — a failed
 * delete only leaves an orphaned object (logged for later sweeping), which
 * must not block the DB delete that already succeeded. Also clears any cached
 * presigned URL so clients don't get a link to a gone object. Safe to call
 * with an empty/whitespace list.
 */
export async function deleteR2Objects(storageKeys: Array<string | null | undefined>): Promise<void> {
  const keys = storageKeys.filter((k): k is string => typeof k === "string" && k.length > 0);
  if (keys.length === 0) return;

  let r2: S3Client;
  let bucket: string;
  try {
    r2 = createR2Client();
    bucket = getR2BucketName();
  } catch (err) {
    console.warn("[r2] skipping object delete — R2 not configured", err);
    return;
  }

  await Promise.all(
    keys.map(async (key) => {
      try {
        await r2.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
        invalidatePresignedUrlCache(key);
      } catch (err) {
        console.warn(`[r2] failed to delete object ${key}`, err);
      }
    }),
  );
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
 * Returns true when the string is an absolute http(s) URL we can hand to
 * the browser as-is. Legacy asset rows stored the bare storageKey
 * (e.g. "tickets/abc/brief/foo.jpeg") into Asset.url; if we returned
 * that the <img src> would resolve it relative to the current page URL
 * and request something like /admin/tickets/<id>/tickets/abc/brief/foo
 * — silent 404 that just looks like a broken image.
 */
function isAbsoluteHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
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
  // If it's a stable, absolute (non-presigned) URL, return as-is.
  // The absolute-URL guard prevents legacy rows that stored the raw
  // storage key in the `url` column from being handed to the browser
  // as a relative path — see isAbsoluteHttpUrl above.
  if (existingUrl && isAbsoluteHttpUrl(existingUrl) && !isPresignedUrl(existingUrl)) {
    return existingUrl;
  }

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
    // Defensive: only cache + return if the SDK actually produced an
    // absolute URL. If R2_ENDPOINT is misconfigured the SDK can return
    // something the browser would treat as relative — better to render
    // a placeholder than a broken `<img>`.
    if (!isAbsoluteHttpUrl(url)) return null;
    presignedUrlCache.set(storageKey, { url, cachedUntil: now + PRESIGNED_CACHE_TTL_MS });
    return url;
  } catch {
    return null;
  }
}
