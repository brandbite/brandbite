// -----------------------------------------------------------------------------
// @file: app/talent/layout.tsx
// @purpose: Metadata-only server wrapper for the public talent application
//           page. Mirrors app/login/layout.tsx — no marketing chrome on
//           purpose, the page renders its own slim header to keep the
//           multi-section form a high-intent conversion experience.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Apply to join brandbite",
  description:
    "Tell us about your work and how you'd like to collaborate. We review every application and reply within a few days.",
  openGraph: {
    title: "Apply to join brandbite",
    description:
      "Tell us about your work and how you'd like to collaborate. We review every application and reply within a few days.",
    type: "website",
  },
};

export default function TalentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
