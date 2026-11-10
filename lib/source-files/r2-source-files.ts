// -----------------------------------------------------------------------------
// @file: lib/source-files/r2-source-files.ts
// @purpose: R2 fallback for source files: presigned PUT so the browser uploads
//           straight to R2 (never through Vercel), HEAD to verify the upload,
//           presigned GET to download as an attachment. R2 egress is free,
//           so downloads cost nothing as long as they go straight to R2.
//
//           Needs a CORS rule on the bucket allowing PUT from our origins.
// -----------------------------------------------------------------------------

import { GetObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { createR2Client, getR2BucketName } from "@/lib/r2";

/** Long enough to push a few GB over a slow connection. */
const UPLOAD_URL_SECONDS = 6 * 60 * 60;
const DOWNLOAD_URL_SECONDS = 10 * 60;

export async function presignSourceFileUpload(key: string, contentType: string): Promise<string> {
  const cmd = new PutObjectCommand({
    Bucket: getR2BucketName(),
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(createR2Client(), cmd, { expiresIn: UPLOAD_URL_SECONDS });
}

/** Size of the stored object, or null when it isn't there. */
export async function sourceFileObjectSize(key: string): Promise<number | null> {
  try {
    const head = await createR2Client().send(
      new HeadObjectCommand({ Bucket: getR2BucketName(), Key: key }),
    );
    return typeof head.ContentLength === "number" ? head.ContentLength : null;
  } catch {
    return null;
  }
}

function attachmentHeader(name: string): string {
  const ascii = name.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "'");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

export async function presignSourceFileDownload(key: string, name: string): Promise<string> {
  const cmd = new GetObjectCommand({
    Bucket: getR2BucketName(),
    Key: key,
    ResponseContentDisposition: attachmentHeader(name),
  });
  return getSignedUrl(createR2Client(), cmd, { expiresIn: DOWNLOAD_URL_SECONDS });
}
