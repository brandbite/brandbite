// -----------------------------------------------------------------------------
// @file: app/colors/image-to-palette/page.tsx
// @purpose: Extract a starting palette from an image in the browser.
// -----------------------------------------------------------------------------

import { ImagePaletteView } from "@/components/colors/studio/image-palette-view";
import { StudioShell } from "@/components/colors/studio/studio-shell";

export default function ImageToPalettePage() {
  return (
    <StudioShell
      title="A palette hiding in"
      accent="every picture."
      blurb="Pull a starting palette from your logo, photo or moodboard."
      breadcrumb="Image to palette"
    >
      <ImagePaletteView />
    </StudioShell>
  );
}
