// -----------------------------------------------------------------------------
// @file: app/blog/layout.tsx
// @purpose: Server-component wrapper whose sole job is to contribute page
//           metadata (title + description). The sibling page.tsx is
//           "use client" and can't export metadata on its own; adding this
//           layout gives the /blog listing a distinct <title> for screen
//           readers, browser tabs, and search crawlers.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Blog",
  description: "Design tips, brand strategy, and creative trends from the Brandbite team.",
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return children;
}
