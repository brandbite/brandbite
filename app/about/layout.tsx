// -----------------------------------------------------------------------------
// @file: app/about/layout.tsx
// @purpose: Metadata-only server wrapper for the CMS-driven /about page.
//           The rendered content comes from the CmsPage row (pageKey "about"),
//           but the metadata here gives crawlers + screen readers a stable
//           title independent of what's been authored inside the CMS body.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About",
  description: "About Brandbite — the creative-as-a-service platform.",
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
