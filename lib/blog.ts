// -----------------------------------------------------------------------------
// @file: lib/blog.ts
// @purpose: Small helpers for the public blog pages (2026 redesign) —
//           reading-time estimate from the rich-HTML body and the
//           "Jul 12, 2026" date format used across the Figma designs.
// -----------------------------------------------------------------------------

/** Estimated minutes to read a rich-HTML body at ~200 wpm (min 1). */
export function readMinutes(body: string | null): number {
  if (!body) return 1;
  const words = body
    .replace(/<[^>]+>/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/** "Jul 12, 2026" — the date format used in the blog designs. */
export function formatPostDate(date: Date | string | null): string {
  if (!date) return "";
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(date));
  } catch {
    return "";
  }
}
