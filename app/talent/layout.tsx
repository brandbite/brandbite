// -----------------------------------------------------------------------------
// @file: app/talent/layout.tsx
// @purpose: Metadata-only server wrapper for the public talent application
//           page. Mirrors app/login/layout.tsx — no marketing chrome on
//           purpose, the page renders its own slim header to keep the
//           multi-section form a high-intent conversion experience.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Apply to join Brandbite",
  description:
    "Tell us about your work and how you'd like to collaborate. We review every application and reply within a few days.",
  openGraph: {
    title: "Apply to join Brandbite",
    description:
      "Tell us about your work and how you'd like to collaborate. We review every application and reply within a few days.",
    type: "website",
  },
  // Keep the form out of search results until we've validated the funnel
  // (admin queue lands in PR2). Re-enable once the team is staffed to
  // respond.
  robots: { index: false, follow: false },
};

export default function TalentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
