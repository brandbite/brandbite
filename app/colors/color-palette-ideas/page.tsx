// -----------------------------------------------------------------------------
// @file: app/colors/color-palette-ideas/page.tsx
// @purpose: Curated palette gallery, in the first HTML. CMS entries come first,
//           followed by the built-in catalog.
// -----------------------------------------------------------------------------

import { PaletteIdeasView } from "@/components/colors/studio/palette-ideas-view";
import { StudioShell } from "@/components/colors/studio/studio-shell";
import { getPaletteIdeas } from "@/lib/colors/content";

// Next.js needs a literal here: CMS changes show up within 5 minutes.
export const revalidate = 300;

export default async function PaletteIdeasPage() {
  const ideas = await getPaletteIdeas();
  return (
    <StudioShell
      title="Good palettes."
      accent="Great possibilities."
      blurb="Curated color combinations for every mood, market and moment."
      ctaBlurb="Turn curated palettes into real brand assets with Brandbite."
    >
      <PaletteIdeasView ideas={ideas} />
    </StudioShell>
  );
}
