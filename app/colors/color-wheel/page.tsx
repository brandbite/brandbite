// -----------------------------------------------------------------------------
// @file: app/colors/color-wheel/page.tsx
// @purpose: Interactive color wheel for building harmonies.
// -----------------------------------------------------------------------------

import { ColorWheelView } from "@/components/colors/studio/color-wheel-view";
import { StudioShell } from "@/components/colors/studio/studio-shell";

export default function ColorWheelPage() {
  return (
    <StudioShell
      title="Find your color"
      accent="chemistry."
      blurb="Pick a base color and let harmony do the rest."
      ctaBlurb="Turn any color idea into something on-brand, right now."
    >
      <ColorWheelView />
    </StudioShell>
  );
}
