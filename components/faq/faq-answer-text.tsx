// -----------------------------------------------------------------------------
// @file: components/faq/faq-answer-text.tsx
// @purpose: FAQ answers are plain text from the Faq table. This turns
//           brandbite.studio links ("brandbite.studio/meet") into page links
//           and email addresses into mailto links, so an answer can send
//           people somewhere without a rich-text editor. Everything else
//           stays plain text.
// -----------------------------------------------------------------------------

import Link from "next/link";
import type { ReactNode } from "react";

// Group 1: an email address. Group 2: a brandbite.studio address, with its
// path in group 3. The email alternative comes first so "hello@brandbite.studio"
// is never read as a site link.
const LINKS =
  /([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})|((?:https?:\/\/)?(?:www\.)?brandbite\.studio(\/[A-Za-z0-9\-/_#?=&.]*[A-Za-z0-9\-/_#?=&])?)/g;

export function linkifyFaqAnswer(text: string, linkClassName?: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(LINKS)) {
    const start = match.index ?? 0;
    if (start > last) parts.push(text.slice(last, start));
    const [whole, email, , path] = match;
    parts.push(
      email ? (
        <a key={start} href={`mailto:${email}`} className={linkClassName}>
          {email}
        </a>
      ) : (
        <Link key={start} href={path || "/"} className={linkClassName}>
          {whole.replace(/^https?:\/\/(www\.)?/, "")}
        </Link>
      ),
    );
    last = start + whole.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}
