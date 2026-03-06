// -----------------------------------------------------------------------------
// @file: lib/ai/replicate.ts
// @purpose: Replicate service client (Flux Pro image gen + RMBG background removal)
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
// Image Generation (Flux Pro)
// ---------------------------------------------------------------------------

export type FluxImageSize = "1024x1024" | "1024x768" | "768x1024" | "1440x1024" | "1024x1440";

export type FluxImageResult = {
  url: string;
};

export async function generateImageFlux(
  prompt: string,
  options: { size?: FluxImageSize } = {},
): Promise<FluxImageResult> {
  const client = getReplicateClient();
  const { size = "1024x1024" } = options;

  const [width, height] = size.split("x").map(Number);

  const output = await client.run("black-forest-labs/flux-pro", {
    input: {
      prompt,
      width,
      height,
      num_outputs: 1,
      guidance_scale: 3.5,
      num_inference_steps: 28,
    },
  });

  // Replicate returns an array of URLs or a FileOutput
  const url = extractUrl(output);
  if (!url) {
    throw new Error("No image returned from Flux Pro");
  }

  return { url };
}

// ---------------------------------------------------------------------------
// Background Removal (RMBG 2.0)
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
