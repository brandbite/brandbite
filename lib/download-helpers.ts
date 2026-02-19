// -----------------------------------------------------------------------------
// @file: lib/download-helpers.ts
// @purpose: Client-side download utilities for single assets and zip bundles
// @version: v1.0.0
// @status: active
// @lastUpdate: 2025-11-25
// -----------------------------------------------------------------------------

import JSZip from "jszip";

/**
 * Fetch a presigned download URL for a single asset.
 */
export async function fetchPresignedUrl(assetId: string): Promise<string> {
  const res = await fetch(`/api/assets/${assetId}/download`);
  if (!res.ok) throw new Error(`Failed to get download URL for ${assetId}`);
  const json = await res.json();
  if (!json?.downloadUrl) throw new Error(`No downloadUrl for ${assetId}`);
  return json.downloadUrl as string;
}

/**
 * Trigger a browser download for a single file.
 * Fetches the blob first to guarantee download behaviour
 * (presigned URLs may open in-browser for images otherwise).
 */
export async function downloadSingleAsset(
  assetId: string,
  filename: string,
): Promise<void> {
  const presignedUrl = await fetchPresignedUrl(assetId);

  const response = await fetch(presignedUrl);
  if (!response.ok) throw new Error(`Download failed (${response.status})`);
  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename || "download";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}

/**
 * Download multiple assets as a zip file (client-side).
 * Fetches all presigned URLs + blobs in parallel, then bundles with jszip.
 */
export async function downloadAssetsAsZip(
  assets: { id: string; originalName: string | null }[],
  zipFilename: string,
): Promise<{ total: number; failed: number }> {
  const zip = new JSZip();

  // Fetch all files in parallel — use allSettled so one failure doesn't kill the batch
  const results = await Promise.allSettled(
    assets.map(async (asset, index) => {
      const url = await fetchPresignedUrl(asset.id);
      const response = await fetch(url);
      if (!response.ok)
        throw new Error(`Download failed for ${asset.originalName ?? asset.id} (${response.status})`);
      const blob = await response.blob();
      const name = asset.originalName || `file-${index + 1}`;
      return { name, blob };
    }),
  );

  // Collect successful entries
  const entries = results
    .filter(
      (r): r is PromiseFulfilledResult<{ name: string; blob: Blob }> =>
        r.status === "fulfilled",
    )
    .map((r) => r.value);

  const failed = results.length - entries.length;

  if (entries.length === 0) {
    throw new Error("All file downloads failed. Please try again.");
  }

  // Handle duplicate filenames within the zip
  const usedNames = new Map<string, number>();
  for (const entry of entries) {
    let finalName = entry.name;
    const count = usedNames.get(finalName) ?? 0;
    if (count > 0) {
      const dotIndex = finalName.lastIndexOf(".");
      if (dotIndex > 0) {
        finalName = `${finalName.slice(0, dotIndex)}-${count}${finalName.slice(dotIndex)}`;
      } else {
        finalName = `${finalName}-${count}`;
      }
    }
    usedNames.set(entry.name, count + 1);
    zip.file(finalName, entry.blob);
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  const blobUrl = URL.createObjectURL(zipBlob);

  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = zipFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);

  return { total: results.length, failed };
}
