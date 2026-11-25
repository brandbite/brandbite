// -----------------------------------------------------------------------------
// @file: lib/ai/openai.ts
// @purpose: OpenAI client for image generation (GPT Image). Text tools use
//           Claude, see lib/ai/anthropic.ts.
// -----------------------------------------------------------------------------

import OpenAI from "openai";

import { canvasId, type Canvas } from "@/lib/image-tools/ai-extend";

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

/** Settings that improve a result but that not every image model takes. */
const OPTIONAL_EDIT_SETTINGS = ["background", "output_compression", "output_format"] as const;

function badRequestText(error: unknown): string | null {
  if ((error as { status?: number })?.status !== 400) return null;
  return `${(error as { code?: string })?.code ?? ""} ${(error as Error)?.message ?? ""}`;
}

/** The optional setting a "400 … does not support the 'x' parameter" answer is about, if any. */
export function rejectedEditSetting(error: unknown): string | null {
  const about = badRequestText(error);
  if (about === null) return null;
  return OPTIONAL_EDIT_SETTINGS.find((name) => about.includes(name)) ?? null;
}

/**
 * Whether a 400 answer is the model refusing the canvas size it was asked
 * for. OpenAI names the parameter in `param`; the message is checked too,
 * since it quotes the refused size ("Invalid value: '1536x800'").
 */
export function rejectedSize(error: unknown): boolean {
  const about = badRequestText(error);
  if (about === null) return false;
  if ((error as { param?: string })?.param === "size") return true;
  return /\bsizes?\b|invalid_size|resolution|dimension|'\d+x\d+'/i.test(about);
}

/**
 * Lay a design out again on a canvas of another shape. The model redraws the
 * whole picture, so the prompt carries the rules about what must not change.
 *
 * `canvases` are tried in order: the shape that is wanted first, then a size
 * every image model takes, for a model that refuses the first. `promptFor`
 * gives the instructions for whichever canvas is used.
 *
 * Asks for a JPG, because the answer travels back through a function
 * response where a PNG of this size could be too large. Image models differ
 * in which extras they take: when one is refused, the call is repeated
 * without it rather than failing.
 */
export async function recomposeImage({
  image,
  canvases,
  promptFor,
  userId,
}: {
  image: File;
  canvases: Canvas[];
  promptFor: (canvas: Canvas) => string;
  /** Passed to OpenAI as an opaque id, to help them spot abuse. */
  userId?: string;
}): Promise<{ bytes: Buffer; contentType: "image/jpeg" | "image/png"; canvas: Canvas }> {
  const settings: Record<string, unknown> = {
    background: "opaque",
    output_format: "jpeg",
    output_compression: 92,
  };
  // Two canvases that turn out the same size are one try, not two.
  const queue = canvases.filter(
    (canvas, index) => canvases.findIndex((c) => canvasId(c) === canvasId(canvas)) === index,
  );
  if (queue.length === 0) throw new Error("No canvas to draw on.");

  // Each retry removes something the model refused, so this ends.
  for (;;) {
    const canvas = queue[0];
    try {
      const response = await getOpenAIClient().images.edit({
        model: imageModel(),
        image,
        prompt: promptFor(canvas),
        n: 1,
        // Newer models take any size within their limits; the SDK's list is older.
        size: canvasId(canvas) as ImageSize,
        ...settings,
        ...(userId ? { user: userId } : {}),
      });
      const result = response.data?.[0];
      if (!result?.b64_json) throw new Error("The image model returned no image.");
      return {
        bytes: Buffer.from(result.b64_json, "base64"),
        contentType: settings.output_format === "jpeg" ? "image/jpeg" : "image/png",
        canvas,
      };
    } catch (error) {
      const setting = rejectedEditSetting(error);
      if (setting && setting in settings) {
        delete settings[setting];
        // Compression only means something for a JPG.
        if (setting === "output_format") delete settings.output_compression;
        continue;
      }
      if (rejectedSize(error) && queue.length > 1) {
        queue.shift();
        continue;
      }
      throw error;
    }
  }
}

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
