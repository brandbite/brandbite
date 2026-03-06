// -----------------------------------------------------------------------------
// @file: lib/ai/prompts.ts
// @purpose: Centralized prompt templates for AI tools
// -----------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Image Generation Prompts
// ---------------------------------------------------------------------------

export function buildImagePrompt(
  brief: string,
  options: { jobType?: string; style?: string } = {},
): string {
  const parts = [brief];

  if (options.jobType) {
    parts.push(`This is for a ${options.jobType} project.`);
  }

  if (options.style) {
    parts.push(`Style: ${options.style}.`);
  }

  parts.push("Create a professional, high-quality design.");

  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// Copy / Text Generation Prompts
// ---------------------------------------------------------------------------

export type CopyFormat =
  | "tagline"
  | "headline"
  | "social_post"
  | "email_subject"
  | "ad_copy"
  | "custom";

export type CopyTone = "professional" | "casual" | "playful" | "bold" | "elegant" | "technical";

export function buildCopySystemPrompt(
  format: CopyFormat,
  tone: CopyTone,
  variations: number = 3,
): string {
  const formatGuide: Record<CopyFormat, string> = {
    tagline: "short, memorable taglines (5-10 words each)",
    headline: "compelling headlines for ads or landing pages (8-15 words each)",
    social_post: "engaging social media posts (1-3 sentences each)",
    email_subject: "high-open-rate email subject lines (5-12 words each)",
    ad_copy: "persuasive ad copy paragraphs (2-4 sentences each)",
    custom: "creative copy based on the brief",
  };

  return `You are an expert copywriter for creative brands. Generate exactly ${variations} variations of ${formatGuide[format]}.
Tone: ${tone}.
Return ONLY a JSON array of strings, e.g. ["variation 1", "variation 2", "variation 3"].
No explanations, no markdown — just the JSON array.`;
}

export function buildCopyPrompt(brief: string, options: { wordCount?: number } = {}): string {
  let prompt = brief;
  if (options.wordCount) {
    prompt += ` Target approximately ${options.wordCount} words per variation.`;
  }
  return prompt;
}

// ---------------------------------------------------------------------------
// Design Suggestion Prompts
// ---------------------------------------------------------------------------

export function buildSuggestionPrompt(brief: string): string {
  return `Analyze this creative project brief and provide professional design suggestions:\n\n${brief}`;
}

// ---------------------------------------------------------------------------
// Refinement Prompts (for iteration)
// ---------------------------------------------------------------------------

export function buildRefinementPrompt(originalPrompt: string, feedback: string): string {
  return `Original request: ${originalPrompt}\n\nFeedback on the previous result: ${feedback}\n\nPlease create an improved version incorporating the feedback.`;
}
