// -----------------------------------------------------------------------------
// @file: app/login/layout.tsx
// @purpose: Metadata-only server wrapper for the sign-in page.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your Brandbite account.",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
