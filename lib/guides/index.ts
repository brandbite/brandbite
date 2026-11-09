// -----------------------------------------------------------------------------
// @file: lib/guides/index.ts
// @purpose: Public guides at /guides. Written in code like the Support guides
//           (same block format), with the same CMS layer on top (audience
//           PUBLIC in GuideEntry), plus page metadata kept here: the tool each
//           guide points to and when its content last changed.
// -----------------------------------------------------------------------------

import type { GuideBlock, SupportGuide } from "@/lib/support/types";

import { BRAND_COLORS_GUIDE } from "./articles/brand-colors";
import { CREATIVE_BRIEF_GUIDE } from "./articles/creative-brief";
import { FONT_PAIRING_GUIDE } from "./articles/font-pairing";
import { FREELANCER_AGENCY_GUIDE } from "./articles/freelancer-agency-in-house";

export const PUBLIC_GUIDES: SupportGuide[] = [
  CREATIVE_BRIEF_GUIDE,
  BRAND_COLORS_GUIDE,
  FONT_PAIRING_GUIDE,
  FREELANCER_AGENCY_GUIDE,
];

export type GuideMeta = {
  /** ISO date the code version was published or last changed meaningfully. */
  updatedOn: string;
  tool: { href: string; label: string; blurb: string };
  /** Other site pages worth linking from the article. */
  links: { href: string; label: string }[];
};

export const GUIDE_META: Record<string, GuideMeta> = {
  [CREATIVE_BRIEF_GUIDE.slug]: {
    updatedOn: "2026-11-09",
    tool: {
      href: "/brief-generator",
      label: "Write your brief",
      blurb:
        "Answer a few guided questions and get a brief you can copy, download or save as a PDF.",
    },
    links: [{ href: "/sizes", label: "Social media size guide" }],
  },
  [BRAND_COLORS_GUIDE.slug]: {
    updatedOn: "2026-11-09",
    tool: {
      href: "/brand-kit",
      label: "Make your brand kit",
      blurb: "Turn one color into a five-color palette with fonts, previewed on real designs.",
    },
    links: [
      { href: "/colors/color-palette-generator", label: "Color palette generator" },
      { href: "/colors/color-wheel", label: "Color wheel" },
      { href: "/colors/contrast-checker", label: "Contrast checker" },
      { href: "/colors/color-meanings", label: "Color meanings" },
    ],
  },
  [FONT_PAIRING_GUIDE.slug]: {
    updatedOn: "2026-11-09",
    tool: {
      href: "/brand-kit/font-pairings",
      label: "Browse font pairings",
      blurb: "24 hand-picked Google Font pairings, each shown in its own fonts.",
    },
    links: [{ href: "/brand-kit", label: "Brand kit generator" }],
  },
  [FREELANCER_AGENCY_GUIDE.slug]: {
    updatedOn: "2026-11-09",
    tool: {
      href: "/design-cost-calculator",
      label: "Compare the costs",
      blurb:
        "Pick your monthly design work and see what a freelancer, agency or in-house designer costs.",
    },
    links: [{ href: "/brief-generator", label: "Creative brief generator" }],
  },
};

/** Fallback for CMS-only guides, which have no code metadata. */
export const DEFAULT_GUIDE_META: GuideMeta = {
  updatedOn: "2026-11-09",
  tool: {
    href: "/meet",
    label: "Talk to us",
    blurb: "See how brandbite can take design work off your plate.",
  },
  links: [],
};

export function guideMeta(slug: string): GuideMeta {
  return GUIDE_META[slug] ?? DEFAULT_GUIDE_META;
}

function blockWords(block: GuideBlock): number {
  const text =
    block.type === "steps"
      ? block.items.join(" ")
      : block.type === "list"
        ? block.items
            .map((item) => (typeof item === "string" ? item : `${item.term} ${item.text}`))
            .join(" ")
        : block.type === "figure"
          ? ""
          : block.text;
  return text.split(/\s+/).filter(Boolean).length;
}

export function wordCount(guide: SupportGuide): number {
  return guide.sections.reduce(
    (sum, section) => sum + section.blocks.reduce((s, block) => s + blockWords(block), 0),
    guide.summary.split(/\s+/).length,
  );
}

/** Minutes to read at about 220 words a minute, never less than one. */
export function readMinutes(guide: SupportGuide): number {
  return Math.max(1, Math.round(wordCount(guide) / 220));
}

/** Anchor id for a section heading, for the table of contents. */
export function sectionAnchor(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
