// -----------------------------------------------------------------------------
// @file: lib/brand/upload-brand-file.ts
// @purpose: Upload one file to the company's brand guide from the browser:
//           ask for an upload link, send the file straight to storage, then
//           have the server confirm it arrived. Throws with a message a
//           person can read.
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-11-15
// -----------------------------------------------------------------------------

import { brandFileProblem, type BrandAssetKindValue } from "./brand-files";

async function readError(res: Response, fallback: string): Promise<string> {
  const json = (await res.json().catch(() => null)) as { error?: string } | null;
  return json?.error ?? fallback;
}

/** Resolves with the saved file as the brand API returns it. */
export async function uploadBrandFile<T = unknown>(
  file: File,
  kind: BrandAssetKindValue,
): Promise<T> {
  const problem = brandFileProblem(file);
  if (problem) throw new Error(problem);

  const start = await fetch("/api/customer/brand/assets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: file.name, sizeBytes: file.size, kind }),
  });
  if (!start.ok) throw new Error(await readError(start, "Could not start the upload."));
  const { assetId, uploadUrl, contentType } = await start.json();

  const put = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
  });
  if (!put.ok) throw new Error("The upload didn't go through. Please try again.");

  const done = await fetch(`/api/customer/brand/assets/${assetId}/complete`, { method: "POST" });
  if (!done.ok) throw new Error(await readError(done, "Could not finish the upload."));
  return (await done.json()).asset as T;
}
