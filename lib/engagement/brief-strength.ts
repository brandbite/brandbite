// -----------------------------------------------------------------------------
// @file: lib/engagement/brief-strength.ts
// @purpose: The three details that make a brief easy to start on, checked
//           live on the new-request form: a reference, the dimensions, and a
//           linked moodboard. Pure and client-safe; nothing is stored.
// -----------------------------------------------------------------------------

export type BriefDetail = "reference" | "dimensions" | "moodboard";

export const BRIEF_DETAILS: { key: BriefDetail; label: string }[] = [
  { key: "reference", label: "Reference attached" },
  { key: "dimensions", label: "Dimensions specified" },
  { key: "moodboard", label: "Moodboard linked" },
];

export type BriefStrength = Record<BriefDetail, boolean>;

/** Rich-text HTML → plain text, enough for pattern checks. */
function plain(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&times;/g, "×");
}

const DIMENSION_PATTERNS = [
  /\d+(?:[.,]\d+)?\s*(?:x|×|by)\s*\d+/i, // 1080 x 1350, 8.5×11, 300 by 250
  /\d+(?:[.,]\d+)?\s*(?:px|pixels?|mm|cm|inch(?:es)?|in\b|pt|dpi|"|″)/i, // 1080px, 21 cm, 300 dpi
  /\b\d{1,2}\s*:\s*\d{1,2}\b/, // 16:9, 4:5
  /\b(?:A[0-6]|letter|legal|tabloid|DL)\b(?:\s+size)?/, // paper sizes
];

/** True when the brief text names a size, ratio or paper format. */
export function mentionsDimensions(briefHtml: string): boolean {
  const text = plain(briefHtml);
  return DIMENSION_PATTERNS.some((pattern) => pattern.test(text));
}

/** True when the brief text carries a link (a reference to look at). */
export function mentionsLink(briefHtml: string): boolean {
  return /https?:\/\/\S+|href=/i.test(briefHtml);
}

export function briefStrength(input: {
  briefHtml: string;
  attachmentCount: number;
  moodboardLinked: boolean;
}): BriefStrength {
  return {
    reference: input.attachmentCount > 0 || mentionsLink(input.briefHtml),
    dimensions: mentionsDimensions(input.briefHtml),
    moodboard: input.moodboardLinked,
  };
}

export function briefStrengthCount(strength: BriefStrength): number {
  return BRIEF_DETAILS.filter((d) => strength[d.key]).length;
}
