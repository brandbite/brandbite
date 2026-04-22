// -----------------------------------------------------------------------------
// @file: app/contact/layout.tsx
// @purpose: Metadata-only server wrapper for the CMS-driven /contact page.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with Brandbite.",
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
