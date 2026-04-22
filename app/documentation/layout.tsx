// -----------------------------------------------------------------------------
// @file: app/documentation/layout.tsx
// @purpose: Metadata-only server wrapper for the documentation tree. Nested
//           routes (category slugs, article slugs) can override via their own
//           layout / generateMetadata where data-driven titles make sense.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Documentation",
  description: "Guides and reference for using Brandbite as a customer or creative.",
};

export default function DocumentationLayout({ children }: { children: React.ReactNode }) {
  return children;
}
