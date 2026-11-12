// -----------------------------------------------------------------------------
// @file: lib/support/merge.ts
// @purpose: Combines the guides written in code with the CMS layer
//           (GuideEntry rows). Code is the default; a CMS row can replace a
//           code guide's text, hide it, or add a guide that exists only in the
//           CMS. Pure, so it runs anywhere and is tested without a database.
// -----------------------------------------------------------------------------

import { isEngagementFeature } from "@/lib/engagement/switches";

import type { GuideBlock, GuideSection, SupportGuide } from "./types";

/** The parts of a guide an admin can edit. Routes and links stay in code. */
export type GuideContent = {
  title: string;
  summary: string;
  category: string;
  keywords: string[];
  sections: GuideSection[];
};

export type GuideCodeStatus = "IN_SYNC" | "CODE_CHANGED" | "CODE_REMOVED";

/** The fields of a GuideEntry row the merge needs. */
export type GuideEntryLike = {
  slug: string;
  fromCode: boolean;
  hidden: boolean;
  content: unknown;
  codeStatus: GuideCodeStatus;
};

export function contentOf(guide: SupportGuide): GuideContent {
  return {
    title: guide.title,
    summary: guide.summary,
    category: guide.category,
    keywords: guide.keywords ?? [],
    sections: guide.sections,
  };
}

const BLOCK_TYPES = new Set(["p", "steps", "list", "tip", "warning", "figure"]);

/** Figure images: an https URL (CMS uploads) or a path on this site. */
export function isFigureImage(value: string): boolean {
  return /^https:\/\/\S+$/.test(value) || /^\/[^/\s]\S*$/.test(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

/** Reads one block and keeps its feature mark, if it has a valid one. */
function parseBlock(raw: unknown): GuideBlock | null {
  const block = parseBlockBody(raw);
  if (!block) return null;
  const { feature } = raw as Record<string, unknown>;
  return isEngagementFeature(feature) ? { ...block, feature } : block;
}

function parseBlockBody(raw: unknown): GuideBlock | null {
  if (!raw || typeof raw !== "object") return null;
  const block = raw as Record<string, unknown>;
  if (!isString(block.type) || !BLOCK_TYPES.has(block.type)) return null;
  if (block.type === "p" || block.type === "tip" || block.type === "warning") {
    return isString(block.text) && block.text.trim()
      ? { type: block.type, text: block.text }
      : null;
  }
  if (block.type === "figure") {
    if (!isString(block.caption) || !block.caption.trim()) return null;
    const figure: GuideBlock = { type: "figure", caption: block.caption.trim() };
    if (isString(block.image) && isFigureImage(block.image.trim())) {
      figure.image = block.image.trim();
    }
    if (isString(block.mobileImage) && isFigureImage(block.mobileImage.trim())) {
      figure.mobileImage = block.mobileImage.trim();
    }
    if (isString(block.alt) && block.alt.trim()) figure.alt = block.alt.trim();
    return figure;
  }
  if (!Array.isArray(block.items)) return null;
  if (block.type === "steps") {
    const items = block.items.filter((item): item is string => isString(item) && !!item.trim());
    return items.length ? { type: "steps", items } : null;
  }
  const items = block.items
    .map((item) => {
      if (isString(item)) return item.trim() ? item : null;
      if (item && typeof item === "object") {
        const { term, text } = item as Record<string, unknown>;
        if (isString(term) && isString(text) && term.trim()) return { term, text };
      }
      return null;
    })
    .filter((item): item is string | { term: string; text: string } => item !== null);
  return items.length ? { type: "list", items } : null;
}

/** Reads stored content back, dropping anything malformed. Null if unusable. */
export function parseGuideContent(raw: unknown): GuideContent | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  if (!isString(data.title) || !data.title.trim()) return null;
  const sections = Array.isArray(data.sections)
    ? data.sections
        .map((section) => {
          if (!section || typeof section !== "object") return null;
          const { heading, blocks, feature } = section as Record<string, unknown>;
          if (!isString(heading) || !Array.isArray(blocks)) return null;
          const parsed = blocks.map(parseBlock).filter((b): b is GuideBlock => b !== null);
          if (!parsed.length) return null;
          const out: GuideSection = { heading, blocks: parsed };
          if (isEngagementFeature(feature)) out.feature = feature;
          return out;
        })
        .filter((s): s is GuideSection => s !== null)
    : [];
  if (sections.length === 0) return null;
  return {
    title: data.title.trim(),
    summary: isString(data.summary) ? data.summary.trim() : "",
    category: isString(data.category) && data.category.trim() ? data.category.trim() : "Other",
    keywords: Array.isArray(data.keywords) ? data.keywords.filter(isString) : [],
    sections,
  };
}

export type MergedGuides = {
  /** Guides to show, in code order, then CMS-only guides by title. */
  guides: SupportGuide[];
  /** Code guides an admin hid. Links to them go to the Support home. */
  hiddenSlugs: string[];
};

export function mergeGuides(code: SupportGuide[], entries: GuideEntryLike[]): MergedGuides {
  const bySlug = new Map(entries.map((entry) => [entry.slug, entry]));
  const codeSlugs = new Set(code.map((guide) => guide.slug));
  const guides: SupportGuide[] = [];
  const hiddenSlugs: string[] = [];

  for (const guide of code) {
    const entry = bySlug.get(guide.slug);
    if (entry?.hidden) {
      hiddenSlugs.push(guide.slug);
      continue;
    }
    const content = entry ? parseGuideContent(entry.content) : null;
    // An edit stays live while code changes are reviewed; it can't be lost.
    guides.push(content ? { ...guide, ...content } : guide);
  }

  const cmsOnly: SupportGuide[] = [];
  for (const entry of entries) {
    if (entry.hidden || codeSlugs.has(entry.slug)) continue;
    // fromCode rows whose guide left the code wait for an admin to decide.
    if (entry.fromCode) continue;
    const content = parseGuideContent(entry.content);
    if (content) cmsOnly.push({ slug: entry.slug, routes: [], related: [], ...content });
  }
  cmsOnly.sort((a, b) => a.title.localeCompare(b.title));

  return { guides: [...guides, ...cmsOnly], hiddenSlugs };
}

/** Stable JSON: object keys sorted, so equal content always serialises the same. */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

/**
 * The status of an edit of a code guide: still in step with code, code has
 * changed since the edit, or code no longer has the guide.
 */
export function codeStatusFor(
  entry: { fromCode: boolean; baseCodeHash: string | null; content: unknown },
  currentCodeHash: string | null,
): GuideCodeStatus {
  if (!entry.fromCode) return "IN_SYNC";
  if (currentCodeHash === null) return "CODE_REMOVED";
  // A hide-only row has no text of its own, so code changes show through.
  if (entry.content === null || entry.content === undefined) return "IN_SYNC";
  return entry.baseCodeHash === currentCodeHash ? "IN_SYNC" : "CODE_CHANGED";
}
