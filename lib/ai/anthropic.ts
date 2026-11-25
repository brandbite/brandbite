// -----------------------------------------------------------------------------
// @file: lib/ai/anthropic.ts
// @purpose: Claude client for every AI tool that writes text: copy, design
//           suggestions and brief parsing.
// -----------------------------------------------------------------------------

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

/** The Claude model behind the text tools. Override with ANTHROPIC_TEXT_MODEL. */
export function textModel(): string {
  return process.env.ANTHROPIC_TEXT_MODEL || "claude-opus-5-5";
}

/**
 * Lets the API re-run a request on another model when the first one declines
 * it, so a customer gets an answer instead of a refusal where one exists.
 */
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

/**
 * Room for the answer and the model's own reasoning (thinking counts toward
 * the cap). The tools' answers are short; this only guards against a cut-off.
 */
const MAX_TOKENS = 16000;

let _client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!_client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      const error: Error & { code?: string } = new Error("MISSING_ENV:ANTHROPIC_API_KEY");
      error.code = "MISSING_ENV";
      throw error;
    }
    _client = new Anthropic();
  }
  return _client;
}

export type TextUsage = { promptTokens: number; completionTokens: number };

export type TextGenerationResult = {
  text: string;
  usage: TextUsage;
  /** The model that answered (a fallback model when the first one declined). */
  model: string;
};

/** Thrown when the model (and its fallbacks) declined the request. */
export class AiRefusalError extends Error {
  constructor() {
    super("The AI model declined this request.");
    this.name = "AiRefusalError";
  }
}

function baseParams(prompt: string, systemPrompt: string) {
  return {
    model: textModel(),
    max_tokens: MAX_TOKENS,
    // These are short writing jobs; low effort keeps them quick.
    output_config: { effort: "low" as const },
    betas: [FALLBACK_BETA],
    fallbacks: "default" as const,
    system: systemPrompt,
    messages: [{ role: "user" as const, content: prompt }],
  };
}

function textOf(content: Anthropic.Beta.BetaContentBlock[]): string {
  return content
    .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
}

function usageOf(usage: { input_tokens: number; output_tokens: number }): TextUsage {
  return { promptTokens: usage.input_tokens, completionTokens: usage.output_tokens };
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

export async function generateText(
  prompt: string,
  systemPrompt: string,
): Promise<TextGenerationResult> {
  const response = await getAnthropicClient().beta.messages.create(
    baseParams(prompt, systemPrompt),
  );
  if (response.stop_reason === "refusal") throw new AiRefusalError();
  return { text: textOf(response.content), usage: usageOf(response.usage), model: response.model };
}

// ---------------------------------------------------------------------------
// Streaming text
// ---------------------------------------------------------------------------

export type TextStreamChunk = {
  /** Incremental text from the model. Empty on the final chunk. */
  text: string;
  /** Present only on the final chunk. */
  usage?: TextUsage;
  /** True on the final chunk. */
  done: boolean;
};

export async function* generateTextStream(
  prompt: string,
  systemPrompt: string,
): AsyncGenerator<TextStreamChunk, void, unknown> {
  const stream = getAnthropicClient().beta.messages.stream(baseParams(prompt, systemPrompt));

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield { text: event.delta.text, done: false };
    }
  }

  const final = await stream.finalMessage();
  // A refusal can arrive after some text went out; the caller discards it.
  if (final.stop_reason === "refusal") throw new AiRefusalError();
  yield { text: "", usage: usageOf(final.usage), done: true };
}

// ---------------------------------------------------------------------------
// Design suggestions (structured)
// ---------------------------------------------------------------------------

const DesignSuggestionSchema = z.object({
  colors: z.array(z.object({ hex: z.string(), name: z.string(), usage: z.string() })),
  fonts: z.object({ heading: z.string(), body: z.string(), rationale: z.string() }),
  layoutTips: z.array(z.string()),
  overallDirection: z.string(),
});

export type DesignSuggestion = z.infer<typeof DesignSuggestionSchema>;

export async function getDesignSuggestions(
  brief: string,
  options: { includeColors?: boolean; includeFonts?: boolean; includeLayout?: boolean } = {},
): Promise<DesignSuggestion & { model: string }> {
  const { includeColors = true, includeFonts = true, includeLayout = true } = options;

  const parts = [];
  if (includeColors)
    parts.push("a color palette (5 colors with hex codes, names and where to use each)");
  if (includeFonts)
    parts.push("a font pairing (heading and body fonts, with the reason they work)");
  if (includeLayout) parts.push("layout tips (3 to 5 suggestions the designer can act on)");

  const systemPrompt = `You are a professional graphic designer. Read the project brief and give design suggestions: ${parts.join(", ")}, plus a short summary of the overall creative direction. Hex codes are written like #1F3A5F. For any section that was not asked for, return an empty list or empty strings.`;

  const response = await getAnthropicClient().beta.messages.parse({
    ...baseParams(brief, systemPrompt),
    output_config: { effort: "low", format: betaZodOutputFormat(DesignSuggestionSchema) },
  });
  if (response.stop_reason === "refusal") throw new AiRefusalError();
  if (!response.parsed_output)
    throw new Error("The design suggestions came back in a shape we couldn't read.");
  return { ...response.parsed_output, model: response.model };
}

// ---------------------------------------------------------------------------
// Copy options (structured)
// ---------------------------------------------------------------------------

const CopyOptionsSchema = z.object({ options: z.array(z.string()) });

/**
 * Several versions of one short piece of copy, each a plain string. The
 * caller writes both prompts (lib/brand-copy/copy.ts) and cleans the result.
 */
export async function writeCopyOptions(
  systemPrompt: string,
  prompt: string,
): Promise<{ options: string[]; usage: TextUsage; model: string }> {
  const response = await getAnthropicClient().beta.messages.parse({
    ...baseParams(prompt, systemPrompt),
    output_config: { effort: "low", format: betaZodOutputFormat(CopyOptionsSchema) },
  });
  if (response.stop_reason === "refusal") throw new AiRefusalError();
  if (!response.parsed_output) throw new Error("The copy came back in a shape we couldn't read.");
  return {
    options: response.parsed_output.options,
    usage: usageOf(response.usage),
    model: response.model,
  };
}
