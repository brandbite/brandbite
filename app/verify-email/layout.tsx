// -----------------------------------------------------------------------------
// @file: app/verify-email/layout.tsx
// @purpose: Metadata-only server wrapper for the email-verification flow.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Verify your email",
  description: "Confirm your email to finish setting up your Brandbite account.",
};

export default function VerifyEmailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
