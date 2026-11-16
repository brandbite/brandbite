// -----------------------------------------------------------------------------
// @file: lib/ai/openai.ts
// @purpose: OpenAI client for image generation (GPT Image). Text tools use
//           Claude, see lib/ai/anthropic.ts.
// -----------------------------------------------------------------------------

import OpenAI from "openai";

/** The image model. Override with OPENAI_IMAGE_MODEL. */
export function imageModel(): string {
  return process.env.OPENAI_IMAGE_MODEL || "gpt-image-2.6-flare";
}

let _client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!_client) {
    if (!process.env.OPENAI_API_KEY) {
      const error: Error & { code?: string } = new Error("MISSING_ENV:OPENAI_API_KEY");
      error.code = "MISSING_ENV";
      throw error;
    }
    _client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      organization: process.env.OPENAI_ORG_ID || undefined,
    });
  }
  return _client;
}

export const IMAGE_SIZES = ["1024x1024", "1024x1536", "1536x1024"] as const;
export type ImageSize = (typeof IMAGE_SIZES)[number];

/**
 * The size to ask for. Sizes saved before the move to GPT Image (the old
 * portrait and landscape) map to today's portrait and landscape.
 */
export function normalizeImageSize(size: string | null | undefined): ImageSize {
  if ((IMAGE_SIZES as readonly string[]).includes(size ?? "")) return size as ImageSize;
  if (size === "1024x1792") return "1024x1536";
  if (size === "1792x1024") return "1536x1024";
  return "1024x1024";
}

export type ImageGenerationResult = {
  /** The image itself. GPT Image returns the file, not a link. */
  bytes: Buffer;
  contentType: "image/png";
  revisedPrompt?: string;
};

export async function generateImage(
  prompt: string,
  options: { size?: string | null } = {},
): Promise<ImageGenerationResult> {
  const response = await getOpenAIClient().images.generate({
    model: imageModel(),
    prompt,
    n: 1,
    size: normalizeImageSize(options.size),
    output_format: "png",
  });

  const image = response.data?.[0];
  if (!image?.b64_json) throw new Error("The image model returned no image.");

  return {
    bytes: Buffer.from(image.b64_json, "base64"),
    contentType: "image/png",
    revisedPrompt: image.revised_prompt ?? undefined,
  };
}
