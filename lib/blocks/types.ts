// -----------------------------------------------------------------------------
// @file: lib/blocks/types.ts
// @purpose: Single source of truth for the typed shape of every page block.
//
//           A block has a string `type` (the discriminator stored on
//           `PageBlock.type`) and a `data` payload validated against the
//           Zod schema below. Adding a new block type requires:
//             1. A new entry in the `BLOCK_TYPES` const
//             2. A Zod schema for its data shape
//             3. A render component (components/blocks/*.tsx)
//             4. (eventually) An admin form (components/blocks/admin/*.tsx)
//
//           The registry in `lib/blocks/registry.ts` ties these together.
// -----------------------------------------------------------------------------

import { z } from "zod";

/* ---------------------------------------------------------------------------
 * Block type identifiers — closed set. New types are a code change, not a
 * data change.
 * ------------------------------------------------------------------------- */

export const BLOCK_TYPES = {
  HERO: "HERO",
  HOW_IT_WORKS: "HOW_IT_WORKS",
  PRICING: "PRICING",
  SHOWCASE: "SHOWCASE",
  FEATURE_GRID: "FEATURE_GRID",
  FAQ: "FAQ",
  CALL_TO_ACTION: "CALL_TO_ACTION",
} as const;

export type BlockType = (typeof BLOCK_TYPES)[keyof typeof BLOCK_TYPES];

/* ---------------------------------------------------------------------------
 * Per-type Zod schemas.
 *
 * IMPORTANT: keep these schemas defensive — they're applied to every
 * incoming admin save AND every existing DB row before render. A bad
 * legacy row should fail loud at parse time so the page surface never
 * displays half-defined content.
 * ------------------------------------------------------------------------- */

/** Common URL string allowing internal paths or absolute URLs. Used for
 *  CTA hrefs. Disallows javascript: / data: schemes (which would be open
 *  XSS / phishing routes if an admin account were compromised). */
const safeUrlSchema = z.string().refine(
  (v) => {
    if (v.startsWith("/")) return true;
    try {
      const u = new URL(v);
      return u.protocol === "https:" || u.protocol === "http:" || u.protocol === "mailto:";
    } catch {
      return false;
    }
  },
  { message: "must be an internal path (/...) or http(s)/mailto URL" },
);

/** Image reference. Either a hosted URL (rare — when an admin pastes one)
 *  or an R2 storage key the renderer presigns at request time (preferred). */
const imageRefSchema = z.object({
  storageKey: z.string().min(1).optional(),
  url: z.string().min(1).optional(),
});

/* -- HERO ----------------------------------------------------------------- */

export const HERO_VARIANTS = [
  /** Centered text, no image. The current landing-page hero. */
  "centered",
  /** Text on left, image on right. */
  "image-right",
  /** Image on left, text on right. */
  "image-left",
  /** Full-bleed background image with text overlay. */
  "full-bleed",
] as const;

export const heroDataSchema = z.object({
  variant: z.enum(HERO_VARIANTS).default("centered"),
  /** Required headline. The big H1 above the fold. */
  headline: z.string().min(1).max(200),
  /** Sub-headline / supporting paragraph. Optional but recommended. */
  subhead: z.string().max(500).optional(),
  /** CTA button. Both label and href required when shown — use null to omit. */
  ctaLabel: z.string().max(50).optional(),
  ctaHref: safeUrlSchema.optional(),
  /** Hero image. Required for non-centered variants; ignored when present
   *  for `centered`. The renderer hides itself gracefully if missing. */
  image: imageRefSchema.optional(),
  /** Optional secondary CTA (e.g. "See examples"). */
  secondaryCtaLabel: z.string().max(50).optional(),
  secondaryCtaHref: safeUrlSchema.optional(),
});

export type HeroData = z.infer<typeof heroDataSchema>;

/* -- HOW_IT_WORKS --------------------------------------------------------- */

export const howItWorksDataSchema = z.object({
  /** Optional eyebrow / label above the section. */
  eyebrow: z.string().max(50).optional(),
  /** Optional title above the steps. */
  title: z.string().max(120).optional(),
  /** 3 to 5 steps; the design renders 3 nicely. */
  steps: z
    .array(
      z.object({
        title: z.string().min(1).max(80),
        description: z.string().min(1).max(300),
      }),
    )
    .min(1)
    .max(5),
});

export type HowItWorksData = z.infer<typeof howItWorksDataSchema>;

/* -- PRICING -------------------------------------------------------------- */

/** Pricing block has no editable price content — prices come from the DB
 *  (Stripe-driven, see /api/plans). The block just renders the existing
 *  pricing section with optional title / subtitle copy. */
export const pricingDataSchema = z.object({
  eyebrow: z.string().max(50).optional(),
  title: z.string().max(120).optional(),
  subtitle: z.string().max(300).optional(),
});

export type PricingData = z.infer<typeof pricingDataSchema>;

/* -- SHOWCASE ------------------------------------------------------------- */

/** Showcase block similarly defers to the existing /api/showcase data
 *  source. Block stores only the section's framing copy. */
export const showcaseDataSchema = z.object({
  title: z.string().max(120).optional(),
  subtitle: z.string().max(300).optional(),
  ctaLabel: z.string().max(50).optional(),
  ctaHref: safeUrlSchema.optional(),
});

export type ShowcaseData = z.infer<typeof showcaseDataSchema>;

/* -- FEATURE_GRID --------------------------------------------------------- */

export const featureGridDataSchema = z.object({
  title: z.string().max(120).optional(),
  subtitle: z.string().max(300).optional(),
  /** 1 to 12 items. The default grid renders 5 nicely with auto-wrap. */
  items: z
    .array(
      z.object({
        title: z.string().min(1).max(120),
        body: z.string().max(400).optional(),
        /** Optional emoji or icon name to render before the title. */
        emoji: z.string().max(8).optional(),
      }),
    )
    .min(1)
    .max(12),
  /** Optional supporting image rendered alongside the grid. */
  image: imageRefSchema.optional(),
  /** Optional CTA below the grid. */
  ctaLabel: z.string().max(50).optional(),
  ctaHref: safeUrlSchema.optional(),
});

export type FeatureGridData = z.infer<typeof featureGridDataSchema>;

/* -- FAQ ------------------------------------------------------------------ */

/**
 * FAQ block on a page is a *picker* over the central Faq table — the
 * inline `qas: [{q, a}]` shape from the original block (PR #190) was
 * replaced once /admin/faq landed (PR B). The block now stores:
 *   - optional title + subtitle for the section header
 *   - selectedFaqIds: ordered list of Faq.id values to render
 *
 * Empty selectedFaqIds means "no FAQs selected yet" — the renderer
 * falls back to showing the first N active FAQs so the demo and any
 * pre-launch site looks right without explicit selection.
 *
 * The cap of 40 mirrors the previous schema; lifting it would require
 * UX changes on the picker (search/pagination), so 40 is a soft sanity
 * upper bound that no realistic landing page should hit.
 */
export const faqDataSchema = z.object({
  title: z.string().max(120).optional(),
  subtitle: z.string().max(300).optional(),
  selectedFaqIds: z.array(z.string().min(1).max(50)).max(40).default([]),
});

export type FaqData = z.infer<typeof faqDataSchema>;

/* -- CALL_TO_ACTION ------------------------------------------------------- */

export const callToActionDataSchema = z.object({
  headline: z.string().min(1).max(200),
  subhead: z.string().max(400).optional(),
  ctaLabel: z.string().min(1).max(50),
  ctaHref: safeUrlSchema,
});

export type CallToActionData = z.infer<typeof callToActionDataSchema>;

/* ---------------------------------------------------------------------------
 * Discriminated union — one entry per block type. Used by parseBlockData()
 * below to validate any incoming { type, data } pair against the correct
 * schema.
 * ------------------------------------------------------------------------- */

export type BlockData =
  | { type: typeof BLOCK_TYPES.HERO; data: HeroData }
  | { type: typeof BLOCK_TYPES.HOW_IT_WORKS; data: HowItWorksData }
  | { type: typeof BLOCK_TYPES.PRICING; data: PricingData }
  | { type: typeof BLOCK_TYPES.SHOWCASE; data: ShowcaseData }
  | { type: typeof BLOCK_TYPES.FEATURE_GRID; data: FeatureGridData }
  | { type: typeof BLOCK_TYPES.FAQ; data: FaqData }
  | { type: typeof BLOCK_TYPES.CALL_TO_ACTION; data: CallToActionData };

const SCHEMA_BY_TYPE = {
  [BLOCK_TYPES.HERO]: heroDataSchema,
  [BLOCK_TYPES.HOW_IT_WORKS]: howItWorksDataSchema,
  [BLOCK_TYPES.PRICING]: pricingDataSchema,
  [BLOCK_TYPES.SHOWCASE]: showcaseDataSchema,
  [BLOCK_TYPES.FEATURE_GRID]: featureGridDataSchema,
  [BLOCK_TYPES.FAQ]: faqDataSchema,
  [BLOCK_TYPES.CALL_TO_ACTION]: callToActionDataSchema,
} as const;

/**
 * Parse a raw block row from the DB (or an admin save body) into a typed
 * `BlockData` discriminated union. Returns `null` if the type is unknown
 * or the data fails validation — callers are expected to skip invalid
 * blocks rather than crash the page.
 */
export function parseBlockData(input: { type: string; data: unknown }): BlockData | null {
  if (!isKnownBlockType(input.type)) return null;
  const schema = SCHEMA_BY_TYPE[input.type];
  const parsed = schema.safeParse(input.data);
  if (!parsed.success) {
    console.warn("[blocks] invalid block data", {
      type: input.type,
      issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    });
    return null;
  }
  // The cast here is safe — we just narrowed `input.type` and parsed `data`
  // against the matching schema for that branch of the union.
  return { type: input.type, data: parsed.data } as BlockData;
}

export function isKnownBlockType(t: string): t is BlockType {
  return Object.values(BLOCK_TYPES).includes(t as BlockType);
}
