// -----------------------------------------------------------------------------
// @file: lib/brand/brand-context.ts
// @purpose: The one place that turns a brand guide into text for an AI prompt.
//           Every AI feature takes its brand context from here, so a new brand
//           field reaches all of them at once. No server imports.
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-11-15
// -----------------------------------------------------------------------------

import type { BrandColor, BrandFont } from "./brand-data";

/**
 * What the builder reads. Mirrors the Brand row, plus the four older
 * per-project fields, which fill in whatever the brand guide leaves empty.
 */
export type BrandContextSource = {
  name?: string | null;
  tagline?: string | null;
  description?: string | null;
  audience?: string | null;
  values?: string[];
  references?: string | null;
  toneWords?: string[];
  voiceNotes?: string | null;
  voiceDo?: string[];
  voiceDont?: string[];
  wordsToUse?: string[];
  wordsToAvoid?: string[];
  sampleCopy?: string | null;
  colors?: BrandColor[];
  fonts?: BrandFont[];
  imageryNotes?: string | null;
  /** Project.brandLogoUrl / brandColors / brandFonts / brandVoice, as typed. */
  legacy?: {
    logoUrl?: string | null;
    colors?: string | null;
    fonts?: string | null;
    voice?: string | null;
  };
};

/**
 * - "image": a short, one-line note on the look, for image models.
 * - "text": who the brand is and how it sounds, for copy.
 * - "brief": everything, for describing what a request should deliver.
 */
export type BrandContextPurpose = "image" | "text" | "brief";

/** Longest single value in an image prompt; image models cap prompt length. */
const IMAGE_VALUE_MAX = 300;

function clean(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function list(values: string[] | undefined): string {
  return (values ?? [])
    .map((v) => clean(v))
    .filter(Boolean)
    .join(", ");
}

function clip(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;
}

function describeColor(color: BrandColor): string {
  const label = color.name ? `${color.name} ${color.hex}` : color.hex;
  return color.role ? `${label} (${color.role})` : label;
}

function describeFont(font: BrandFont): string {
  return font.role ? `${font.name} (${font.role})` : font.name;
}

type Line = { label: string; value: string };

function lookLines(source: BrandContextSource): Line[] {
  const colors =
    (source.colors ?? []).map(describeColor).join(", ") || clean(source.legacy?.colors);
  const fonts = (source.fonts ?? []).map(describeFont).join(", ") || clean(source.legacy?.fonts);
  return [
    { label: "Brand colors", value: colors },
    { label: "Fonts", value: fonts },
    { label: "Imagery", value: clean(source.imageryNotes) },
  ];
}

function voiceLines(source: BrandContextSource): Line[] {
  return [
    { label: "Tone", value: list(source.toneWords) },
    { label: "Voice", value: clean(source.voiceNotes) || clean(source.legacy?.voice) },
  ];
}

function identityLines(source: BrandContextSource): Line[] {
  return [
    { label: "Brand", value: clean(source.name) },
    { label: "Tagline", value: clean(source.tagline) },
    { label: "What they do", value: clean(source.description) },
    { label: "Audience", value: clean(source.audience) },
    { label: "Values", value: list(source.values) },
  ];
}

function languageLines(source: BrandContextSource): Line[] {
  return [
    ...voiceLines(source),
    { label: "Write like this", value: list(source.voiceDo) },
    { label: "Never write like this", value: list(source.voiceDont) },
    { label: "Words to use", value: list(source.wordsToUse) },
    { label: "Words to avoid", value: list(source.wordsToAvoid) },
    { label: "Sample copy", value: clean(source.sampleCopy) },
  ];
}

/** True when the lines hold more than the brand's name. */
function hasSubstance(lines: Line[]): boolean {
  return lines.some((line) => line.value && line.label !== "Brand");
}

/**
 * Brand context for an AI prompt, or null when the guide has nothing useful
 * for that purpose (a name alone doesn't count).
 */
export function buildBrandContext(
  source: BrandContextSource | null | undefined,
  purpose: BrandContextPurpose,
): string | null {
  if (!source) return null;

  if (purpose === "image") {
    const lines = [...lookLines(source), ...voiceLines(source)].filter((line) => line.value);
    if (lines.length === 0) return null;
    const parts = lines.map((line) => `${line.label}: ${clip(line.value, IMAGE_VALUE_MAX)}`);
    return `Brand guide — ${parts.join("; ")}.`;
  }

  const lines =
    purpose === "text"
      ? [...identityLines(source), ...languageLines(source)]
      : [
          ...identityLines(source),
          ...languageLines(source),
          ...lookLines(source),
          { label: "Logo", value: clean(source.legacy?.logoUrl) },
        ];
  if (!hasSubstance(lines)) return null;

  const header =
    purpose === "text"
      ? "Brand guide (write in this brand's voice):"
      : "Brand guide (apply when describing deliverables):";
  const body = lines.filter((line) => line.value).map((line) => `${line.label}: ${line.value}`);
  return [header, ...body].join("\n");
}
