// -----------------------------------------------------------------------------
// @file: lib/rich-text-links.ts
// @purpose: Normalises what an editor types into the rich-text "Add link"
//           prompt. It used to prefix https:// to anything without http(s),
//           so "/pricing" became "https:///pricing" and "mailto:x" became
//           "https://mailto:x".
// -----------------------------------------------------------------------------

const KEEP_AS_IS = /^(https?:\/\/|mailto:|tel:)/i;
const ANY_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Returns the href to store, or null when the value must be refused.
 * - http(s), mailto: and tel: links are kept.
 * - Site-relative paths ("/pricing") and in-page anchors ("#faq") are kept.
 * - Any other scheme (javascript:, data:, …) is refused.
 * - Anything else is treated as a bare domain and gets https://.
 */
export function normalizeLinkHref(input: string): string | null {
  const url = input.trim();
  if (url === "") return null;
  if (KEEP_AS_IS.test(url)) return url;
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  if (url.startsWith("#")) return url;
  if (url.startsWith("//")) return `https:${url}`;
  if (ANY_SCHEME.test(url) && !/^[^:]+:\d/.test(url)) return null;
  return `https://${url}`;
}
