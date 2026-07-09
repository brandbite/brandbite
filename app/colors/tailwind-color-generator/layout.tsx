// -----------------------------------------------------------------------------
// @file: app/colors/tailwind-color-generator/layout.tsx
// @purpose: Metadata-only server wrapper for the Tailwind color generator.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tailwind CSS Color Generator",
  description:
    "Turn any color into a full Tailwind CSS shade scale (50–950). Copy the config or CSS variables in one click.",
};

export default function TailwindColorGeneratorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
