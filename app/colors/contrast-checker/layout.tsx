// -----------------------------------------------------------------------------
// @file: app/colors/contrast-checker/layout.tsx
// @purpose: Metadata-only server wrapper for the Contrast checker.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contrast Checker",
  description:
    "Check the WCAG 2.2 AA and AAA text contrast of any color pair, preview it live, and get a readable alternative when it fails.",
};

export default function ContrastCheckerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
