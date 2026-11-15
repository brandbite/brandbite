// -----------------------------------------------------------------------------
// @file: lib/brand/brand-export.ts
// @purpose: A brand guide as text an AI assistant can be given (Markdown) and
//           as JSON for tools. Used by "Copy for AI" and "Download JSON".
//           No server imports.
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-11-15
// -----------------------------------------------------------------------------

import type { BrandColor, BrandFont } from "./brand-data";
import { BRAND_ASSET_KIND_LABELS, type BrandAssetKindValue } from "./brand-files";

export type BrandExport = {
  name: string;
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
};

export type BrandExportFile = { name: string; kind: BrandAssetKindValue };

const text = (value: string | null | undefined) => (value ?? "").trim();
const items = (values: string[] | undefined) =>
  (values ?? []).map((value) => value.trim()).filter(Boolean);

/** "## Heading" plus its lines, or nothing when there are no lines. */
function section(heading: string, lines: string[]): string[] {
  const kept = lines.filter(Boolean);
  return kept.length === 0 ? [] : [`## ${heading}`, "", ...kept, ""];
}

const field = (label: string, value: string) => (value ? `**${label}:** ${value}` : "");
const bullets = (label: string, values: string[]) =>
  values.length === 0 ? "" : [`**${label}:**`, ...values.map((v) => `- ${v}`)].join("\n");

function colorLine(color: BrandColor): string {
  const extras = [color.role, color.cmyk && `CMYK ${color.cmyk}`, color.pantone].filter(Boolean);
  const label = color.name ? `${color.name}: ${color.hex}` : color.hex;
  return `- ${label}${extras.length ? ` (${extras.join(", ")})` : ""}`;
}

function fontLine(font: BrandFont): string {
  const role = font.role ? ` (${font.role})` : "";
  return `- ${font.name}${role}${font.url ? `, ${font.url}` : ""}`;
}

/** The brand guide as Markdown, ready to paste into an AI assistant. */
export function brandToMarkdown(brand: BrandExport, files: BrandExportFile[] = []): string {
  const name = text(brand.name) || "Brand";
  const lines = [
    `# ${name} brand guide`,
    "",
    `Follow this guide for any visual or copy made for ${name}.`,
    "",
    ...section("About", [
      field("Tagline", text(brand.tagline)),
      field("What they do", text(brand.description)),
      field("Audience", text(brand.audience)),
      field("Values", items(brand.values).join(", ")),
      field("Competitors and references", text(brand.references)),
    ]),
    ...section("Brand language", [
      field("Tone", items(brand.toneWords).join(", ")),
      field("Voice", text(brand.voiceNotes)),
      bullets("Write like this", items(brand.voiceDo)),
      bullets("Never write like this", items(brand.voiceDont)),
      field("Words to use", items(brand.wordsToUse).join(", ")),
      field("Words to avoid", items(brand.wordsToAvoid).join(", ")),
      field("Sample copy", text(brand.sampleCopy)),
    ]),
    ...section("Colors", (brand.colors ?? []).map(colorLine)),
    ...section("Fonts", (brand.fonts ?? []).map(fontLine)),
    ...section("Imagery", [text(brand.imageryNotes)]),
    ...section(
      "Brand files",
      files.map((file) => `- ${file.name} (${BRAND_ASSET_KIND_LABELS[file.kind]})`),
    ),
  ];
  return `${lines.join("\n").trimEnd()}\n`;
}

/** The brand guide as JSON, with empty fields left out. */
export function brandToJson(brand: BrandExport, files: BrandExportFile[] = []): string {
  const out: Record<string, unknown> = { name: text(brand.name) || "Brand" };
  const put = (key: string, value: string | unknown[]) => {
    if (value.length > 0) out[key] = value;
  };
  put("tagline", text(brand.tagline));
  put("description", text(brand.description));
  put("audience", text(brand.audience));
  put("values", items(brand.values));
  put("references", text(brand.references));
  put("toneWords", items(brand.toneWords));
  put("voiceNotes", text(brand.voiceNotes));
  put("voiceDo", items(brand.voiceDo));
  put("voiceDont", items(brand.voiceDont));
  put("wordsToUse", items(brand.wordsToUse));
  put("wordsToAvoid", items(brand.wordsToAvoid));
  put("sampleCopy", text(brand.sampleCopy));
  put(
    "colors",
    (brand.colors ?? []).map(({ hex, name, role, cmyk, pantone }) => ({
      hex,
      ...(name ? { name } : {}),
      ...(role ? { role } : {}),
      ...(cmyk ? { cmyk } : {}),
      ...(pantone ? { pantone } : {}),
    })),
  );
  put(
    "fonts",
    (brand.fonts ?? []).map(({ name, role, url }) => ({
      name,
      ...(role ? { role } : {}),
      ...(url ? { url } : {}),
    })),
  );
  put("imageryNotes", text(brand.imageryNotes));
  put(
    "files",
    files.map((file) => ({ name: file.name, kind: file.kind })),
  );
  return `${JSON.stringify(out, null, 2)}\n`;
}

/** A safe file name for the exported guide. */
export function brandExportFileName(name: string, extension: "json" | "md"): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || "brand"}-brand-guide.${extension}`;
}
