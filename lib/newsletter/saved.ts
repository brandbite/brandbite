// -----------------------------------------------------------------------------
// @file: lib/newsletter/saved.ts
// @purpose: What the builder and its routes share about blocks kept for
//           reuse and about a newsletter's earlier versions: their shapes,
//           limits, and how a kept block is read back clean. Pure.
// -----------------------------------------------------------------------------

import { blockTypeInfo, cloneBlock, readNewsletter, type NewsletterBlock } from "./newsletter";

/** Blocks a company can keep for reuse. */
export const SAVED_BLOCKS_MAX = 60;
/** Earlier versions kept per newsletter; older ones are dropped. */
export const VERSIONS_MAX = 30;
/** A new version is written when the last one is at least this old. */
export const VERSION_EVERY_MS = 10 * 60 * 1000;

export type SavedBlock = { id: string; name: string; block: NewsletterBlock };
export type NewsletterVersionSummary = { id: string; createdAt: string; by: string | null };

/** A kept or incoming block, cleaned the same way a whole newsletter is; null when it isn't a block. */
export function readSavedBlock(raw: unknown): NewsletterBlock | null {
  return readNewsletter({ blocks: [raw] })?.blocks[0] ?? null;
}

/** A kept block as a new block for a newsletter, with ids of its own. */
export function placeSavedBlock(saved: SavedBlock, makeId: () => string): NewsletterBlock {
  return cloneBlock(saved.block, makeId);
}

/** A name for a block being kept, from what is in it. */
export function savedBlockName(block: NewsletterBlock): string {
  const label = blockTypeInfo(block.type).label;
  const words =
    ("text" in block && block.text) ||
    ("title" in block && block.title) ||
    ("name" in block && block.name) ||
    ("label" in block && block.label) ||
    "";
  const short = words.replace(/\s+/g, " ").trim().slice(0, 40);
  return short ? `${label}: ${short}` : label;
}
