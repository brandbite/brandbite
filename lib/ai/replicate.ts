// -----------------------------------------------------------------------------
// @file: lib/ai/replicate.ts
// @purpose: Replicate service client (background removal + image upscaling)
// -----------------------------------------------------------------------------

import Replicate from "replicate";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    const error: Error & { code?: string } = new Error(`MISSING_ENV:${name}`);
    error.code = "MISSING_ENV";
    throw error;
  }
  return v;
}

let _client: Replicate | null = null;

export function getReplicateClient(): Replicate {
  if (!_client) {
    _client = new Replicate({
      auth: requireEnv("REPLICATE_API_TOKEN"),
    });
  }
  return _client;
}

// ---------------------------------------------------------------------------
// Background Removal (rembg)
// ---------------------------------------------------------------------------

export type BackgroundRemovalResult = {
  url: string;
};

export async function removeBackground(imageUrl: string): Promise<BackgroundRemovalResult> {
  const client = getReplicateClient();

  const output = await client.run(
    "cjwbw/rembg:fb8af171cfa1616ddcf1242c093f9c46bcada5ad4cf6f2fbe8b81b330ec5c003",
    {
      input: {
        image: imageUrl,
      },
    },
  );

  const url = extractUrl(output);
  if (!url) {
    throw new Error("No image returned from RMBG");
  }

  return { url };
}

// ---------------------------------------------------------------------------
// Image Upscaling (Real-ESRGAN via Replicate)
// ---------------------------------------------------------------------------

export type UpscaleScale = 2 | 4;

export type UpscaleImageResult = {
  url: string;
  scale: UpscaleScale;
};

/**
 * Upscale an existing image by 2x or 4x using nightmareai/real-esrgan. The
 * model is well-tested on Replicate and produces sharp, natural upscales
 * for photos, generated art, and UI mockups. We deliberately don't pass
 * `face_enhance: true` by default because it subtly alters generated faces
 * and users often find that jarring.
 */
export async function upscaleImage(
  imageUrl: string,
  options: { scale?: UpscaleScale; faceEnhance?: boolean } = {},
): Promise<UpscaleImageResult> {
  const client = getReplicateClient();
  const { scale = 4, faceEnhance = false } = options;

  const output = await client.run(
    "nightmareai/real-esrgan:f121d640bd286e1fdc67f9799164c1d5be36ff74576ee11c803ae5b665dd46aa",
    {
      input: {
        image: imageUrl,
        scale,
        face_enhance: faceEnhance,
      },
    },
  );

  const url = extractUrl(output);
  if (!url) {
    throw new Error("No image returned from Real-ESRGAN");
  }

  return { url, scale };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractUrl(output: unknown): string | null {
  if (typeof output === "string") return output;
  if (output && typeof output === "object" && "url" in output) {
    return String((output as { url: unknown }).url);
  }
  if (Array.isArray(output)) {
    for (const item of output) {
      const url = extractUrl(item);
      if (url) return url;
    }
  }
  return null;
}
