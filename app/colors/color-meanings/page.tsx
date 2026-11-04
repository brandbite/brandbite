// -----------------------------------------------------------------------------
// @file: app/colors/color-meanings/page.tsx
// @purpose: Color families with a detail panel. Content is CMS-managed (ColorMeaning).
// -----------------------------------------------------------------------------

import { ColorMeaningsView } from "@/components/colors/studio/color-meanings-view";
import { StudioShell } from "@/components/colors/studio/studio-shell";

export default function ColorMeaningsHubPage() {
  return (
    <StudioShell
      title="Every color has a"
      accent="story."
      blurb="Explore the associations behind a shade, then put it to work."
      ctaBlurb="Turn color insights into on-brand palettes, shades, and more with Brandbite."
    >
      <ColorMeaningsView />
    </StudioShell>
  );
}
