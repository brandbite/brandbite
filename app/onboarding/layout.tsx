// -----------------------------------------------------------------------------
// @file: app/onboarding/layout.tsx
// @purpose: Server wrapper for the customer onboarding wizard: metadata, plus the
//           dashboard design scope (this route sits outside those layouts).
// -----------------------------------------------------------------------------

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Welcome — set up your workspace",
  description: "Complete your brandbite company setup.",
};

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <div className="bb-admin-v2 min-h-screen bg-[var(--av2-bg)]">{children}</div>;
}
