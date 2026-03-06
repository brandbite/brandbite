// -----------------------------------------------------------------------------
// @file: lib/ai/openai.ts
// @purpose: OpenAI service client (GPT-4o + DALL-E 3)
// -----------------------------------------------------------------------------

import OpenAI from "openai";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    const error: Error & { code?: string } = new Error(`MISSING_ENV:${name}`);
    error.code = "MISSING_ENV";
    throw error;
  }
  return v;
}

let _client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      apiKey: requireEnv("OPENAI_API_KEY"),
      organization: process.env.OPENAI_ORG_ID || undefined,
    });
  }
  return _client;
}

// ---------------------------------------------------------------------------
// Image Generation (DALL-E 3)
// ---------------------------------------------------------------------------

export type ImageSize = "1024x1024" | "1024x1792" | "1792x1024";
export type ImageStyle = "vivid" | "natural";

export type ImageGenerationResult = {
  url: string;
  revisedPrompt: string;
};

export async function generateImage(
  prompt: string,
  options: { size?: ImageSize; style?: ImageStyle } = {},
): Promise<ImageGenerationResult> {
  const client = getOpenAIClient();
  const { size = "1024x1024", style = "vivid" } = options;

  const response = await client.images.generate({
    model: "dall-e-3",
    prompt,
    n: 1,
    size,
    style,
    response_format: "url",
  });

  const image = response.data?.[0];
  if (!image?.url) {
    throw new Error("No image returned from DALL-E 3");
  }

  return {
    url: image.url,
    revisedPrompt: image.revised_prompt ?? prompt,
  };
}

// ---------------------------------------------------------------------------
// Text / Copy Generation (GPT-4o)
// ---------------------------------------------------------------------------

export type TextGenerationResult = {
  text: string;
  usage: { promptTokens: number; completionTokens: number };
};

export async function generateText(
  prompt: string,
  systemPrompt: string,
  options: { maxTokens?: number; temperature?: number } = {},
): Promise<TextGenerationResult> {
  const client = getOpenAIClient();
  const { maxTokens = 1024, temperature = 0.8 } = options;

  const response = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ],
    max_tokens: maxTokens,
    temperature,
  });

  const text = response.choices[0]?.message?.content ?? "";

  return {
    text,
    usage: {
      promptTokens: response.usage?.prompt_tokens ?? 0,
      completionTokens: response.usage?.completion_tokens ?? 0,
    },
  };
}

// ---------------------------------------------------------------------------
// Design Suggestions (GPT-4o with structured JSON output)
// ---------------------------------------------------------------------------

export type DesignSuggestion = {
  colors: { hex: string; name: string; usage: string }[];
  fonts: { heading: string; body: string; rationale: string };
  layoutTips: string[];
  overallDirection: string;
};

export async function getDesignSuggestions(
  brief: string,
  options: {
    includeColors?: boolean;
    includeFonts?: boolean;
    includeLayout?: boolean;
  } = {},
): Promise<DesignSuggestion> {
  const { includeColors = true, includeFonts = true, includeLayout = true } = options;

  const parts = [];
  if (includeColors) parts.push("color palette (5 colors with hex codes, names, and usage)");
  if (includeFonts) parts.push("font pairing (heading and body fonts with rationale)");
  if (includeLayout) parts.push("layout tips (3-5 actionable suggestions)");

  const systemPrompt = `You are a professional graphic designer. Analyze the project brief and provide design suggestions. Return valid JSON with this structure:
{
  "colors": [{"hex": "#XXXXXX", "name": "Color Name", "usage": "Where to use it"}],
  "fonts": {"heading": "Font Name", "body": "Font Name", "rationale": "Why these fonts work"},
  "layoutTips": ["tip1", "tip2"],
  "overallDirection": "A brief creative direction summary"
}
Only include the sections requested: ${parts.join(", ")}.
For omitted sections, use empty arrays or empty strings.`;

  const result = await generateText(brief, systemPrompt, {
    maxTokens: 1024,
    temperature: 0.7,
  });

  try {
    // Extract JSON from the response (handle markdown code blocks)
    let jsonStr = result.text;
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1];
    return JSON.parse(jsonStr.trim());
  } catch {
    return {
      colors: [],
      fonts: { heading: "", body: "", rationale: "" },
      layoutTips: [],
      overallDirection: result.text,
    };
  }
}
