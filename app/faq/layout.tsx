// -----------------------------------------------------------------------------
// @file: app/faq/layout.tsx
// @purpose: Metadata-only server wrapper for the "use client" FAQ page.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Answers to common questions about Brandbite plans, workflow, and billing.",
};

export default function FaqLayout({ children }: { children: React.ReactNode }) {
  return children;
}
