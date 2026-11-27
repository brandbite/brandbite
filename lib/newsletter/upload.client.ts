// -----------------------------------------------------------------------------
// @file: lib/newsletter/upload.client.ts
// @purpose: Uploads a picture for a newsletter from the browser: shrinks it
//           to what an email needs, sends it straight to storage and returns
//           the public address to put in the email.
// -----------------------------------------------------------------------------

import { cropSource, type CropAdjust } from "@/lib/image-tools/fit";
import { renderImage } from "@/lib/image-tools/render";

import { cutSize, NEWSLETTER_IMAGE_MAX_BYTES, newsletterImageProblem } from "./images";

/** What the file picker offers. WebP is accepted and stored as PNG or JPG. */
export const NEWSLETTER_UPLOAD_ACCEPT = ["image/png", "image/jpeg", "image/gif", "image/webp"];

/** Which part of a picture to keep: a shape (width over height) and where the frame sits. */
export type ImageCut = { ratio: number; crop: CropAdjust };

/** A picture the company uploaded before. */
export type NewsletterLibraryImage = { url: string; bytes: number; uploadedAt: string };

/** The file as an email-sized PNG, JPG or (untouched) GIF, cut to `cut` when one is given. */
async function prepare(file: File, cut?: ImageCut): Promise<Blob> {
  // Redrawing a GIF would lose its animation.
  if (file.type === "image/gif") return file;
  if (!NEWSLETTER_UPLOAD_ACCEPT.includes(file.type)) {
    throw new Error("Choose a PNG, JPG, GIF or WebP image.");
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("That file couldn't be read as an image.");
  }
  try {
    // The frame the picture is cut to, in the picture's own pixels; the whole picture without a cut.
    const ratio = cut?.ratio ?? bitmap.width / bitmap.height;
    const kept = cropSource(bitmap.width, bitmap.height, 1000, 1000 / ratio, cut?.crop);
    const size = cutSize(kept);
    const draw = (format: "png" | "jpeg") =>
      renderImage(bitmap, {
        ...size,
        mode: "cover",
        format,
        quality: 0.85,
        backdrop: null,
        crop: cut?.crop,
      });
    if (file.type === "image/jpeg") return await draw("jpeg");
    // PNG and WebP may be see-through: keep that unless the file comes out too heavy.
    const png = await draw("png");
    return png.size <= NEWSLETTER_IMAGE_MAX_BYTES ? png : await draw("jpeg");
  } finally {
    bitmap.close();
  }
}

/** Upload a picture and get its public address. Throws with a message for the customer. */
export async function uploadNewsletterImage(file: File, cut?: ImageCut): Promise<string> {
  const blob = await prepare(file, cut);
  const problem = newsletterImageProblem({ type: blob.type, size: blob.size });
  if (problem) throw new Error(problem);

  const started = await fetch("/api/tools/newsletter-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contentType: blob.type, sizeBytes: blob.size }),
  });
  const answer = (await started.json().catch(() => null)) as {
    uploadUrl?: string;
    url?: string;
    error?: string;
  } | null;
  if (!started.ok || !answer?.uploadUrl || !answer.url) {
    throw new Error(answer?.error ?? "Could not start the upload.");
  }

  const sent = await fetch(answer.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": blob.type },
    body: blob,
  }).catch(() => null);
  if (!sent?.ok) throw new Error("The upload didn't go through. Try again.");
  return answer.url;
}
