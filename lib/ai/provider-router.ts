// -----------------------------------------------------------------------------
// @file: lib/ai/provider-router.ts
// @purpose: Routes AI requests to the best available provider with fallback
// -----------------------------------------------------------------------------

import type { AiToolType } from "@prisma/client";
import {
  generateImage as dalleGenerateImage,
  generateText as openaiGenerateText,
  generateTextStream as openaiGenerateTextStream,
  getDesignSuggestions as openaiGetDesignSuggestions,
  type ImageSize,
  type ImageStyle,
  type ImageGenerationResult,
  type TextGenerationResult,
  type TextStreamChunk,
  type DesignSuggestion,
} from "./openai";
import {
  generateImageFlux,
  removeBackground as replicateRemoveBackground,
  type FluxImageSize,
  type FluxImageResult,
  type BackgroundRemovalResult,
} from "./replicate";

// ---------------------------------------------------------------------------
// Provider availability check
// ---------------------------------------------------------------------------

const providerStatus: Record<string, { available: boolean; checkedAt: number }> = {};

const HEALTH_CACHE_MS = 60_000; // 1 minute

export function isProviderAvailable(provider: "openai" | "replicate"): boolean {
  const envKey = provider === "openai" ? "OPENAI_API_KEY" : "REPLICATE_API_TOKEN";
  if (!process.env[envKey]) return false;

  const cached = providerStatus[provider];
  if (cached && Date.now() - cached.checkedAt < HEALTH_CACHE_MS) {
    return cached.available;
  }

  // Default to available if we have the API key
  return true;
}

function markProviderDown(provider: "openai" | "replicate") {
  providerStatus[provider] = { available: false, checkedAt: Date.now() };
}

function markProviderUp(provider: "openai" | "replicate") {
  providerStatus[provider] = { available: true, checkedAt: Date.now() };
}

// ---------------------------------------------------------------------------
// Image Generation (routes to DALL-E 3 or Flux Pro)
// ---------------------------------------------------------------------------

export type GenerateImageOptions = {
  size?: string;
  style?: ImageStyle;
  preferProvider?: "openai" | "replicate";
};

export type GenerateImageResult = {
  url: string;
  provider: "openai" | "replicate";
  model: string;
  revisedPrompt?: string;
};

export async function generateImage(
  prompt: string,
  options: GenerateImageOptions = {},
): Promise<GenerateImageResult> {
  const { preferProvider, size = "1024x1024", style = "vivid" } = options;

  // Try preferred provider first, then fallback
  const providers: ("openai" | "replicate")[] =
    preferProvider === "replicate" ? ["replicate", "openai"] : ["openai", "replicate"];

  for (const provider of providers) {
    if (!isProviderAvailable(provider)) continue;

    try {
      if (provider === "openai") {
        const result = await dalleGenerateImage(prompt, {
          size: size as ImageSize,
          style,
        });
        markProviderUp("openai");
        return {
          url: result.url,
          provider: "openai",
          model: "dall-e-3",
          revisedPrompt: result.revisedPrompt,
        };
      } else {
        const result = await generateImageFlux(prompt, {
          size: size as FluxImageSize,
        });
        markProviderUp("replicate");
        return {
          url: result.url,
          provider: "replicate",
          model: "flux-pro",
        };
      }
    } catch (error) {
      console.error(`[ai:${provider}] image generation failed`, error);
      markProviderDown(provider);
      continue;
    }
  }

  throw new Error("All image generation providers are unavailable");
}

// ---------------------------------------------------------------------------
// Text / Copy Generation (routes to GPT-4o)
// ---------------------------------------------------------------------------

export async function generateText(
  prompt: string,
  systemPrompt: string,
  options: { maxTokens?: number; temperature?: number } = {},
): Promise<TextGenerationResult & { provider: string; model: string }> {
  if (!isProviderAvailable("openai")) {
    throw new Error("OpenAI is not available for text generation");
  }

  const result = await openaiGenerateText(prompt, systemPrompt, options);
  markProviderUp("openai");
  return { ...result, provider: "openai", model: "gpt-4o" };
}

export type TextStreamMeta = { provider: "openai"; model: "gpt-4o" };

/**
 * Streaming variant of {@link generateText}. Returns an async generator of
 * text deltas plus a meta object the caller can forward to the browser.
 */
export function generateTextStream(
  prompt: string,
  systemPrompt: string,
  options: { maxTokens?: number; temperature?: number } = {},
): { meta: TextStreamMeta; chunks: AsyncGenerator<TextStreamChunk, void, unknown> } {
  if (!isProviderAvailable("openai")) {
    throw new Error("OpenAI is not available for text generation");
  }

  const meta: TextStreamMeta = { provider: "openai", model: "gpt-4o" };
  // Defer `markProviderUp` until the stream actually yields its first chunk so
  // a failure before the first token still marks the provider down via the
  // route's catch.
  const chunks = (async function* () {
    let markedUp = false;
    for await (const chunk of openaiGenerateTextStream(prompt, systemPrompt, options)) {
      if (!markedUp) {
        markProviderUp("openai");
        markedUp = true;
      }
      yield chunk;
    }
  })();

  return { meta, chunks };
}

// ---------------------------------------------------------------------------
// Background Removal (routes to Replicate RMBG)
// ---------------------------------------------------------------------------

export async function removeBackground(
  imageUrl: string,
): Promise<BackgroundRemovalResult & { provider: string; model: string }> {
  if (!isProviderAvailable("replicate")) {
    throw new Error("Replicate is not available for background removal");
  }

  const result = await replicateRemoveBackground(imageUrl);
  markProviderUp("replicate");
  return { ...result, provider: "replicate", model: "rmbg-2.0" };
}

// ---------------------------------------------------------------------------
// Design Suggestions (routes to GPT-4o)
// ---------------------------------------------------------------------------

export async function getDesignSuggestions(
  brief: string,
  options: {
    includeColors?: boolean;
    includeFonts?: boolean;
    includeLayout?: boolean;
  } = {},
): Promise<DesignSuggestion & { provider: string; model: string }> {
  if (!isProviderAvailable("openai")) {
    throw new Error("OpenAI is not available for design suggestions");
  }

  const result = await openaiGetDesignSuggestions(brief, options);
  markProviderUp("openai");
  return { ...result, provider: "openai", model: "gpt-4o" };
}

// ---------------------------------------------------------------------------
// Tool type to function mapping
// ---------------------------------------------------------------------------

export function getProviderForTool(toolType: AiToolType): { provider: string; model: string } {
  switch (toolType) {
    case "IMAGE_GENERATION":
      return isProviderAvailable("openai")
        ? { provider: "openai", model: "dall-e-3" }
        : { provider: "replicate", model: "flux-pro" };
    case "BACKGROUND_REMOVAL":
      return { provider: "replicate", model: "rmbg-2.0" };
    case "TEXT_GENERATION":
      return { provider: "openai", model: "gpt-4o" };
    case "DESIGN_SUGGESTION":
      return { provider: "openai", model: "gpt-4o" };
    case "BRIEF_PARSING":
      return { provider: "openai", model: "gpt-4o-mini" };
  }
}
