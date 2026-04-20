// -----------------------------------------------------------------------------
// @file: lib/ai/prompts.ts
// @purpose: Centralized prompt templates for AI tools
// -----------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Image Generation Prompts
// ---------------------------------------------------------------------------

export function buildImagePrompt(
  brief: string,
  options: {
    jobType?: string;
    /** Optional per-job-type tuned guidance (from JobType.aiPromptTemplate). */
    jobTypeTemplate?: string | null;
    style?: string;
  } = {},
): string {
  const parts = [brief];

  if (options.jobType) {
    parts.push(`This is for a ${options.jobType} project.`);
  }

  if (options.jobTypeTemplate) {
    parts.push(`Job-type guidance: ${options.jobTypeTemplate.trim()}`);
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

const COPY_FORMAT_GUIDE: Record<CopyFormat, string> = {
  tagline: "short, memorable taglines (5-10 words each)",
  headline: "compelling headlines for ads or landing pages (8-15 words each)",
  social_post: "engaging social media posts (1-3 sentences each)",
  email_subject: "high-open-rate email subject lines (5-12 words each)",
  ad_copy: "persuasive ad copy paragraphs (2-4 sentences each)",
  custom: "creative copy based on the brief",
};

export function buildCopySystemPrompt(
  format: CopyFormat,
  tone: CopyTone,
  variations: number = 3,
): string {
  return `You are an expert copywriter for creative brands. Generate exactly ${variations} variations of ${COPY_FORMAT_GUIDE[format]}.
Tone: ${tone}.
Return ONLY a JSON array of strings, e.g. ["variation 1", "variation 2", "variation 3"].
No explanations, no markdown — just the JSON array.`;
}

/**
 * Delimiter used between variations in the streaming copy response.
 * Kept out of the response until the model actually outputs it so clients
 * can split cleanly as chunks arrive.
 */
export const STREAM_VARIATION_DELIMITER = "---NEXT---";

/**
 * Streaming-friendly variant of {@link buildCopySystemPrompt}. Instead of a
 * JSON array (which would have to be buffered and parsed at the end), the
 * model emits variations as plain text separated by a stable delimiter so
 * each chunk can be rendered progressively in the UI.
 */
export function buildStreamingCopySystemPrompt(
  format: CopyFormat,
  tone: CopyTone,
  variations: number = 3,
): string {
  return `You are an expert copywriter for creative brands. Generate exactly ${variations} variations of ${COPY_FORMAT_GUIDE[format]}.
Tone: ${tone}.

Output format (strict):
- Emit each variation as plain text.
- Between variations, output the exact delimiter "${STREAM_VARIATION_DELIMITER}" on its own line.
- Do not number the variations, add explanations, or use markdown, quotes, or JSON.
- Do not emit the delimiter before the first variation or after the last one.`;
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

// ---------------------------------------------------------------------------
// Brief Parsing Prompts (free text → structured ticket draft)
// ---------------------------------------------------------------------------

export type BriefParseJobType = {
  id: string;
  name: string;
  description?: string | null;
  defaultQuantity?: number | null;
  hasQuantity?: boolean;
};

export function buildBriefParsingSystemPrompt(jobTypes: BriefParseJobType[]): string {
  const jobList = jobTypes
    .map((j) => {
      const desc = j.description ? ` — ${j.description}` : "";
      const qty = j.hasQuantity ? ` (quantity-based, default ${j.defaultQuantity ?? 1})` : "";
      return `  - ${j.id}: "${j.name}"${qty}${desc}`;
    })
    .join("\n");

  return `You convert a free-text creative brief into a structured ticket draft for a design-subscription platform.

Pick the single best matching job type from this list (use the id as-is, or null when nothing fits):
${jobList || "  (no job types available — return jobTypeId: null)"}

Return ONLY a JSON object with EXACTLY these keys, and no other prose or markdown:
{
  "title": "Short, action-oriented ticket title (under 80 chars)",
  "description": "A crisp 1–3 sentence brief describing what the creative needs to deliver",
  "jobTypeId": "id from the list above or null",
  "quantity": 1,
  "priority": "LOW" | "MEDIUM" | "HIGH" | "URGENT"
}

Rules:
- Title must be concise (not a full sentence, not shouting).
- Description rewrites what the user wrote into clear, professional English.
- quantity is 1 unless the user mentions a specific number.
- priority defaults to MEDIUM; raise to HIGH/URGENT only if the user says deadline, rush, ASAP, etc.
- Never invent a jobTypeId that isn't in the list.`;
}

export function buildBriefParsingPrompt(briefText: string): string {
  return `Customer brief:\n\n${briefText.trim()}`;
}
