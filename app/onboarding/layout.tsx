// -----------------------------------------------------------------------------
// @file: app/onboarding/layout.tsx
// @purpose: Metadata-only server wrapper for the customer onboarding wizard.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Welcome — set up your workspace",
  description: "Complete your Brandbite company setup.",
};

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
