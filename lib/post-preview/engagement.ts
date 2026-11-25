// -----------------------------------------------------------------------------
// @file: lib/post-preview/engagement.ts
// @purpose: The made-up parts of a post preview: like, comment and share
//           counts, sample comments, the handle guessed from a name, and the
//           button labels an ad can carry. Pure.
// -----------------------------------------------------------------------------

export type Engagement = { likes: number; comments: number; shares: number };

export const DEFAULT_ENGAGEMENT: Engagement = { likes: 1248, comments: 86, shares: 24 };
export const MAX_COUNT = 99_999_999;

/** Believable numbers: comments and shares are a small share of the likes. */
export function randomEngagement(random: () => number = Math.random): Engagement {
  // Spread over orders of magnitude, from a few dozen to tens of thousands.
  const likes = Math.round(40 * 10 ** (random() * 3));
  const comments = Math.max(1, Math.round(likes * (0.02 + random() * 0.08)));
  const shares = Math.max(0, Math.round(likes * (0.005 + random() * 0.04)));
  return { likes, comments, shares };
}

/** A typed count as a whole number in range; anything else is 0. */
export function cleanCount(value: string | number): number {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n > 0 ? Math.min(n, MAX_COUNT) : 0;
}

/** 1248 → "1,248", 15300 → "15.3K", 2400000 → "2.4M", the way feeds shorten counts. */
export function formatCount(n: number): string {
  if (n < 10_000) return n.toLocaleString("en-US");
  const [value, unit] = n < 1_000_000 ? [n / 1000, "K"] : [n / 1_000_000, "M"];
  const rounded = value >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
  // 999.96K rounds up to 1000K; show that as 1M.
  if (unit === "K" && rounded >= 1000) return "1M";
  return `${rounded}${unit}`;
}

/** "Acme Studio & Co." → "acmestudioco": a handle to start from. */
export function handleFrom(name: string): string {
  const handle = name
    .normalize("NFKD")
    .replace(/[^\w\s.]/g, "")
    .replace(/[\s_]+/g, "")
    .toLowerCase()
    .slice(0, 30);
  return handle || "yourbrand";
}

/** Invented commenters; no real accounts. */
export const SAMPLE_COMMENTS: { handle: string; name: string; text: string }[] = [
  { handle: "maya.lindqvist", name: "Maya Lindqvist", text: "This looks so good!" },
  { handle: "theo_ramos", name: "Theo Ramos", text: "Been waiting for this. Count me in." },
  { handle: "studio.north", name: "Studio North", text: "Love the colors here." },
];

export const CTA_LABELS = [
  "Learn more",
  "Shop now",
  "Sign up",
  "Book now",
  "Get offer",
  "Contact us",
  "Download",
] as const;

export type CtaLabel = (typeof CTA_LABELS)[number];
