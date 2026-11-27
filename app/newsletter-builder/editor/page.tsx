// -----------------------------------------------------------------------------
// @file: app/newsletter-builder/editor/page.tsx
// @purpose: The newsletter editor's own page: the full-screen workspace, with
//           no site header or footer around it. What it opens comes from the
//           address: ?template=<id> for a ready-made start, ?id=<id> for a
//           newsletter kept in the account, nothing for the browser's draft.
//           Not for search engines; /newsletter-builder is the page they see.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";
import { Suspense } from "react";

import { NewsletterEditor } from "@/components/newsletter/editor/newsletter-editor";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Newsletter editor",
  description: "Build your email newsletter: drag blocks, change the look, export the HTML.",
  path: "/newsletter-builder/editor",
  noindex: true,
});

export default function NewsletterEditorPage() {
  return (
    <Suspense fallback={null}>
      <NewsletterEditor />
    </Suspense>
  );
}
