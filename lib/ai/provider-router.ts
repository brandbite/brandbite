// -----------------------------------------------------------------------------
// @file: lib/ai/provider-router.ts
// @purpose: Which provider does which AI job, and whether that provider is set
//           up. Text (copy, design suggestions, brief parsing) is Claude,
//           image generation is OpenAI, background removal and upscaling are
//           Replicate.
// -----------------------------------------------------------------------------

import type { AiToolType } from "@prisma/client";

import {
  generateText as claudeGenerateText,
  generateTextStream as claudeGenerateTextStream,
  getDesignSuggestions as claudeGetDesignSuggestions,
  textModel,
  type DesignSuggestion,
  type TextGenerationResult,
  type TextStreamChunk,
} from "./anthropic";
import { generateImage as openaiGenerateImage, imageModel } from "./openai";
import {
  removeBackground as replicateRemoveBackground,
  upscaleImage as replicateUpscaleImage,
  type BackgroundRemovalResult,
  type UpscaleImageResult,
  type UpscaleScale,
} from "./replicate";

// ---------------------------------------------------------------------------
// Which provider a tool needs, and whether its key is there
// ---------------------------------------------------------------------------

export type AiProvider = "anthropic" | "openai" | "replicate";

const PROVIDER_ENV: Record<AiProvider, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  replicate: "REPLICATE_API_TOKEN",
};

const TOOL_PROVIDER: Record<AiToolType, AiProvider> = {
  IMAGE_GENERATION: "openai",
  TEXT_GENERATION: "anthropic",
  DESIGN_SUGGESTION: "anthropic",
  BRIEF_PARSING: "anthropic",
  BACKGROUND_REMOVAL: "replicate",
  UPSCALE_IMAGE: "replicate",
};

export const AI_TOOL_TYPES = Object.keys(TOOL_PROVIDER) as AiToolType[];

export function isProviderAvailable(provider: AiProvider): boolean {
  return Boolean(process.env[PROVIDER_ENV[provider]]);
}

/** True when the provider this tool runs on has its key. */
export function isAiToolAvailable(toolType: AiToolType): boolean {
  return isProviderAvailable(TOOL_PROVIDER[toolType]);
}

/** What a tool's API answers when it isn't set up. Nothing is charged. */
export const AI_TOOL_UNAVAILABLE = {
  status: 503,
  body: { error: "This AI tool isn't available yet.", code: "AI_TOOL_UNAVAILABLE" },
} as const;

export function getProviderForTool(toolType: AiToolType): { provider: AiProvider; model: string } {
  switch (toolType) {
    case "IMAGE_GENERATION":
      return { provider: "openai", model: imageModel() };
    case "BACKGROUND_REMOVAL":
      return { provider: "replicate", model: "rembg" };
    case "UPSCALE_IMAGE":
      return { provider: "replicate", model: "real-esrgan" };
    case "TEXT_GENERATION":
    case "DESIGN_SUGGESTION":
    case "BRIEF_PARSING":
      return { provider: "anthropic", model: textModel() };
  }
}

// ---------------------------------------------------------------------------
// Image generation (OpenAI)
// ---------------------------------------------------------------------------

export type GenerateImageResult = {
  /** The image itself; store it (lib/ai/asset-pipeline.ts) before answering. */
  bytes: Buffer;
  contentType: string;
  provider: "openai";
  model: string;
  revisedPrompt?: string;
};

export async function generateImage(
  prompt: string,
  options: { size?: string | null } = {},
): Promise<GenerateImageResult> {
  const result = await openaiGenerateImage(prompt, options);
  return { ...result, provider: "openai", model: imageModel() };
}

// ---------------------------------------------------------------------------
// Text (Claude)
// ---------------------------------------------------------------------------

export async function generateText(
  prompt: string,
  systemPrompt: string,
): Promise<TextGenerationResult & { provider: "anthropic" }> {
  const result = await claudeGenerateText(prompt, systemPrompt);
  return { ...result, provider: "anthropic" };
}

export type TextStreamMeta = { provider: "anthropic"; model: string };

/** Streaming variant of {@link generateText}: text as it is written. */
export function generateTextStream(
  prompt: string,
  systemPrompt: string,
): { meta: TextStreamMeta; chunks: AsyncGenerator<TextStreamChunk, void, unknown> } {
  return {
    meta: { provider: "anthropic", model: textModel() },
    chunks: claudeGenerateTextStream(prompt, systemPrompt),
  };
}

export async function getDesignSuggestions(
  brief: string,
  options: { includeColors?: boolean; includeFonts?: boolean; includeLayout?: boolean } = {},
): Promise<DesignSuggestion & { provider: "anthropic"; model: string }> {
  const result = await claudeGetDesignSuggestions(brief, options);
  return { ...result, provider: "anthropic" };
}

// ---------------------------------------------------------------------------
// Background removal and upscaling (Replicate)
// ---------------------------------------------------------------------------

export async function removeBackground(
  imageUrl: string,
): Promise<BackgroundRemovalResult & { provider: "replicate"; model: string }> {
  const result = await replicateRemoveBackground(imageUrl);
  return { ...result, provider: "replicate", model: "rembg" };
}

export async function upscaleImage(
  imageUrl: string,
  options: { scale?: UpscaleScale; faceEnhance?: boolean } = {},
): Promise<UpscaleImageResult & { provider: "replicate"; model: string }> {
  const result = await replicateUpscaleImage(imageUrl, options);
  return { ...result, provider: "replicate", model: "real-esrgan" };
}
