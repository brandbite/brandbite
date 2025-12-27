// -----------------------------------------------------------------------------
// @file: lib/r2.ts
// @purpose: Cloudflare R2 (S3-compatible) client + helpers for presigned URLs
// @version: v0.1.0
// @status: active
// @lastUpdate: 2025-12-27
// -----------------------------------------------------------------------------

import { S3Client } from "@aws-sdk/client-s3";

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
