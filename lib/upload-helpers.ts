// -----------------------------------------------------------------------------
// @file: lib/upload-helpers.ts
// @purpose: Shared file upload helpers (presign/R2 upload pattern utilities)
// -----------------------------------------------------------------------------

/** The largest file we accept through the server-proxy upload routes
 *  (/api/uploads/r2/upload, /api/uploads/r2/moodboard-presign,
 *  /api/profile/avatar). Vercel's serverless function platform has a
 *  hard ~4.5 MB request-body cap on Hobby/Pro plans, so anything
 *  larger fails *before* our route runs — silent generic error from
 *  the user's perspective. Pinning the in-code limit to 4 MB gives a
 *  small safety margin and lets us surface a clear "max 4 MB" message
 *  client-side rather than relying on platform 413s with no body.
 *
 *  When/if we restore the direct-to-R2 presigned PUT flow this can
 *  be raised — R2 itself accepts up to 5 GB per object. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export const MAX_UPLOAD_LABEL = "4 MB";

/** Pending file awaiting upload */
export type PendingFile = {
  id: string;
  file: File;
};

/** Pre-validate a file against our size cap. Returns null when OK or
 *  a user-friendly error string otherwise. Use this in client uploaders
 *  before submitting so the rejection happens immediately rather than
 *  after a wasted round-trip. */
export function validateFileSize(file: File): string | null {
  if (file.size <= MAX_UPLOAD_BYTES) return null;
  return `${file.name} is ${formatBytes(file.size)}. The current upload limit is ${MAX_UPLOAD_LABEL}.`;
}

/** Translate a server upload-route response into a human message.
 *  Falls back to a generic string when the server didn't surface
 *  anything useful. */
export async function readUploadError(res: Response): Promise<string> {
  const json = (await res.json().catch(() => null)) as {
    error?: string;
    maxBytes?: number;
    details?: string;
  } | null;
  if (res.status === 413) {
    return `File exceeds the ${MAX_UPLOAD_LABEL} upload limit.`;
  }
  if (json?.error === "FILE_TOO_LARGE") {
    return `File exceeds the ${MAX_UPLOAD_LABEL} upload limit.`;
  }
  if (json?.error === "R2_NOT_CONFIGURED") {
    return "File storage isn't configured for this environment. Contact support.";
  }
  if (json?.error === "FORBIDDEN") {
    return "You don't have permission to upload here.";
  }
  if (json?.error === "UNAUTHENTICATED") {
    return "You need to sign in again before uploading.";
  }
  if (json?.error) return json.error;
  return `Upload failed (HTTP ${res.status}).`;
}

/** Format byte count into human-readable string (e.g. "1.2 MB") */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) {
    v = v / 1024;
    i += 1;
  }
  const precision = i === 0 ? 0 : i === 1 ? 0 : 1;
  return `${v.toFixed(precision)} ${units[i]}`;
}

/** Measure image dimensions via DOM Image element */
export async function getImageDimensions(
  file: File,
): Promise<{ width: number; height: number } | null> {
  if (!file.type.startsWith("image/")) return null;

  return await new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      const w = Number(img.naturalWidth) || 0;
      const h = Number(img.naturalHeight) || 0;
      URL.revokeObjectURL(url);

      if (w > 0 && h > 0) {
        resolve({ width: w, height: h });
      } else {
        resolve(null);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };

    img.src = url;
  });
}
