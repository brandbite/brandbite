// -----------------------------------------------------------------------------
// @file: lib/image-tools/ai-extend.client.ts
// @purpose: The browser's half of "Resize with AI": send the design (scaled
//           down to travel quickly) with the size it is wanted in, and hand
//           back the model's new layout as a picture the resizer can use like
//           any other.
// -----------------------------------------------------------------------------

import { AI_UPLOAD_EDGE, worthResizing } from "./ai-extend";

export type AiExtendResult = {
  bitmap: ImageBitmap;
  /** A temporary address for previews; the caller lets go of it. */
  url: string;
  width: number;
  height: number;
  /** Runs the company has left in this 24 hours, when the server said. */
  remaining: number | null;
};

export class AiExtendError extends Error {
  constructor(
    message: string,
    public remaining: number | null = null,
  ) {
    super(message);
  }
}

/** The design as a file small enough to send: long edge capped, WebP. */
async function uploadCopy(source: ImageBitmap): Promise<Blob> {
  const scale = Math.min(1, AI_UPLOAD_EDGE / Math.max(source.width, source.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new AiExtendError("Could not prepare the image.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      // A browser that can't write WebP hands back a PNG, which is accepted too.
      (blob) => (blob ? resolve(blob) : reject(new AiExtendError("Could not prepare the image."))),
      "image/webp",
      0.92,
    ),
  );
}

/**
 * Have the model lay `source` out again for a target size. Resolves with a
 * picture in (nearly) the target's shape; the caller crops it to the exact
 * pixels like any other image.
 */
export async function extendWithAi(
  source: ImageBitmap,
  target: { width: number; height: number },
): Promise<AiExtendResult> {
  if (!worthResizing(source.width, source.height, target.width, target.height)) {
    throw new AiExtendError(
      "This image already has this size's shape. Cropping loses almost nothing.",
    );
  }

  const copy = await uploadCopy(source);
  const body = new FormData();
  body.set("image", copy, copy.type === "image/webp" ? "design.webp" : "design.png");
  body.set("targetWidth", String(target.width));
  body.set("targetHeight", String(target.height));

  let response: Response;
  try {
    response = await fetch("/api/tools/ai-extend", { method: "POST", body });
  } catch {
    throw new AiExtendError("The connection dropped. Check it and try again.");
  }
  if (!response.ok) {
    const json = (await response.json().catch(() => null)) as {
      error?: string;
      remaining?: number;
    } | null;
    throw new AiExtendError(
      json?.error ?? "AI resize didn't work. Try again in a moment.",
      typeof json?.remaining === "number" ? json.remaining : null,
    );
  }

  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);
  const remaining = Number.parseInt(response.headers.get("X-AI-Extend-Remaining") ?? "", 10);
  return {
    bitmap,
    url: URL.createObjectURL(blob),
    width: bitmap.width,
    height: bitmap.height,
    remaining: Number.isFinite(remaining) ? remaining : null,
  };
}
