// -----------------------------------------------------------------------------
// @file: lib/ai/input-images.server.ts
// @purpose: Turn what a customer gave an AI tool (an uploaded file, or a link)
//           into a link the provider can read. Server only.
// -----------------------------------------------------------------------------

import "server-only";

import { HeadObjectCommand } from "@aws-sdk/client-s3";

import { createR2Client, getR2BucketName, resolveAssetUrl } from "@/lib/r2";

import { AI_INPUT_IMAGE_MAX_BYTES, isAiInputKeyOf } from "./input-images";

export type AiInputImage =
  | {
      ok: true;
      /** A link the provider can download the image from. */
      url: string;
      /** How the image is named in the generation's history line. */
      label: string;
      /** What to keep on the generation row. */
      params: { imageUrl?: string; imageKey?: string };
    }
  | { ok: false; error: string };

export async function resolveAiInputImage(input: {
  imageUrl?: unknown;
  imageKey?: unknown;
  imageName?: unknown;
  companyId: string;
}): Promise<AiInputImage> {
  const { companyId } = input;

  if (typeof input.imageKey === "string" && input.imageKey) {
    const key = input.imageKey;
    // Only this company's own uploads; never another key in the bucket.
    if (!isAiInputKeyOf(key, companyId)) return { ok: false, error: "That image wasn't found." };

    let size: number;
    try {
      const head = await createR2Client().send(
        new HeadObjectCommand({ Bucket: getR2BucketName(), Key: key }),
      );
      size = head.ContentLength ?? 0;
    } catch {
      return { ok: false, error: "That image wasn't found. Upload it again." };
    }
    if (size <= 0 || size > AI_INPUT_IMAGE_MAX_BYTES) {
      return { ok: false, error: "That image is larger than 20 MB." };
    }

    const url = await resolveAssetUrl(key, null);
    if (!url) return { ok: false, error: "That image couldn't be read. Upload it again." };

    const name = typeof input.imageName === "string" ? input.imageName.trim().slice(0, 120) : "";
    return { ok: true, url, label: name || "an uploaded image", params: { imageKey: key } };
  }

  const link = typeof input.imageUrl === "string" ? input.imageUrl.trim() : "";
  if (!link) return { ok: false, error: "Upload an image or paste a link to one." };
  if (!/^https?:\/\/\S+$/i.test(link)) {
    return { ok: false, error: "The image link must start with http:// or https://." };
  }
  return { ok: true, url: link, label: link, params: { imageUrl: link } };
}
