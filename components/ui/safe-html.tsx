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

const ALLOWED_TAGS = ["p", "br", "strong", "em", "ul", "ol", "li", "a"];
const ALLOWED_ATTR = ["href", "target", "rel"];

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

type SafeHtmlProps = {
  html: string;
  className?: string;
};

export function SafeHtml({ html, className = "" }: SafeHtmlProps) {
  // Backwards compat: convert plain text (no HTML) to HTML with preserved line breaks
  const source = isPlainText(html) ? plainTextToHtml(html) : html;

  const clean = DOMPurify.sanitize(source, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
  });

  return (
    <div
      className={`bb-rich-text ${className}`}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
