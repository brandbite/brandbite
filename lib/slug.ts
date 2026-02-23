// -----------------------------------------------------------------------------
// @file: lib/slug.ts
// @purpose: URL-friendly slug generation from arbitrary text
// -----------------------------------------------------------------------------

/**
 * Convert a text string into a URL-friendly slug.
 * Strips non-alphanumeric chars, replaces spaces with hyphens, limits to 80 chars.
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}
