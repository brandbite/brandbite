// -----------------------------------------------------------------------------
// @file: app/login/layout.tsx
// @purpose: Metadata-only server wrapper for the sign-in page.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Sign in",
  description: "Sign in to your brandbite account.",
  path: "/login",
  noindex: true,
});

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
