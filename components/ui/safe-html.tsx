// -----------------------------------------------------------------------------
// @file: components/ui/safe-html.tsx
// @purpose: Sanitized HTML renderer for rich text display + stripHtml helper
// @version: v1.0.0
// @status: active
// @lastUpdate: 2025-12-28
// -----------------------------------------------------------------------------

"use client";

import DOMPurify from "isomorphic-dompurify";

/* -------------------------------------------------------------------------- */
/*  Config                                                                     */
/* -------------------------------------------------------------------------- */

/** Default: ticket descriptions, note cards — simple inline rich text. */
const DEFAULT_ALLOWED_TAGS = ["p", "br", "strong", "em", "ul", "ol", "li", "a"];
const DEFAULT_ALLOWED_ATTR = ["href", "target", "rel"];

/** CMS content (blog, news, docs, showcase, pages) — adds headings and media. */
export const CMS_ALLOWED_TAGS = [
  ...DEFAULT_ALLOWED_TAGS,
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "blockquote",
  "code",
  "pre",
  "hr",
  "s",
  "img",
  "figure",
  "figcaption",
];
export const CMS_ALLOWED_ATTR = [...DEFAULT_ALLOWED_ATTR, "src", "alt", "title"];

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/** Returns true if the string contains no HTML tags (i.e. it's plain text). */
function isPlainText(text: string): boolean {
  return !/<[a-z][\s\S]*?>/i.test(text);
}

/** Converts plain text with newlines into simple HTML paragraphs. */
function plainTextToHtml(text: string): string {
  return text
    .split(/\n\n+/)
    .map((para) => `<p>${para.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/**
 * Strips all HTML tags and returns plain text.
 * Useful for card previews with `line-clamp`.
 */
export function stripHtml(html: string): string {
  if (typeof document !== "undefined") {
    const div = document.createElement("div");
    div.innerHTML = html;
    return div.textContent || div.innerText || "";
  }
  // SSR fallback: basic regex strip
  return html.replace(/<[^>]*>/g, "").trim();
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

type SafeHtmlTag = "div" | "article" | "section";

type SafeHtmlProps = {
  html: string;
  className?: string;
  allowedTags?: readonly string[];
  allowedAttrs?: readonly string[];
  /** Semantic wrapper element (defaults to "div"). */
  as?: SafeHtmlTag;
};

export function SafeHtml({
  html,
  className = "",
  allowedTags = DEFAULT_ALLOWED_TAGS,
  allowedAttrs = DEFAULT_ALLOWED_ATTR,
  as: Tag = "div",
}: SafeHtmlProps) {
  // Backwards compat: convert plain text (no HTML) to HTML with preserved line breaks
  const source = isPlainText(html) ? plainTextToHtml(html) : html;

  const clean = DOMPurify.sanitize(source, {
    ALLOWED_TAGS: [...allowedTags],
    ALLOWED_ATTR: [...allowedAttrs],
  });

  return (
    <Tag className={`bb-rich-text ${className}`} dangerouslySetInnerHTML={{ __html: clean }} />
  );
}
