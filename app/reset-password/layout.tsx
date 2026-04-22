// -----------------------------------------------------------------------------
// @file: app/reset-password/layout.tsx
// @purpose: Metadata-only server wrapper for the reset-password flow.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reset password",
  description: "Reset your Brandbite account password.",
};

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
