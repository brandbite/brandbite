// -----------------------------------------------------------------------------
// @file: components/faq/faq-answer-text.tsx
// @purpose: FAQ answers are plain text from the Faq table. This turns
//           brandbite.studio links written in an answer ("brandbite.studio/meet")
//           into real links, so an answer can send people to a page without a
//           rich-text editor. Everything else stays plain text.
// -----------------------------------------------------------------------------

import Link from "next/link";
import type { ReactNode } from "react";

// "brandbite.studio/meet", "https://brandbite.studio/meet", "www.brandbite.studio/x"
const SITE_LINK =
  /(?:https?:\/\/)?(?:www\.)?brandbite\.studio(\/[A-Za-z0-9\-/_#?=&.]*[A-Za-z0-9\-/_#?=&])?/g;

export function linkifyFaqAnswer(text: string, linkClassName?: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(SITE_LINK)) {
    const start = match.index ?? 0;
    if (start > last) parts.push(text.slice(last, start));
    const path = match[1] || "/";
    parts.push(
      <Link key={`${start}-${path}`} href={path} className={linkClassName}>
        {match[0].replace(/^https?:\/\/(www\.)?/, "")}
      </Link>,
    );
    last = start + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}
