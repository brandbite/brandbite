// -----------------------------------------------------------------------------
// @file: app/colors/color-palette-ideas/page.tsx
// @purpose: Public curated palette gallery. Content is CMS-managed (PaletteIdea).
// -----------------------------------------------------------------------------

import { PaletteIdeasView } from "@/components/colors/studio/palette-ideas-view";
import { StudioShell } from "@/components/colors/studio/studio-shell";

export default function PaletteIdeasPage() {
  return (
    <StudioShell
      title="Good palettes."
      accent="Great possibilities."
      blurb="Curated color combinations for every mood, market and moment."
      ctaBlurb="Turn curated palettes into real brand assets with Brandbite."
    >
      <PaletteIdeasView />
    </StudioShell>
  );
}
