// -----------------------------------------------------------------------------
// @file: app/colors/color-palette-generator/page.tsx
// @purpose: Generate, lock and fine-tune palettes under a harmony rule.
// -----------------------------------------------------------------------------

import { PaletteGeneratorView } from "@/components/colors/studio/palette-generator-view";
import { StudioShell } from "@/components/colors/studio/studio-shell";

export default function PaletteGeneratorPage() {
  return (
    <StudioShell
      title="Your next palette,"
      accent="on repeat."
      blurb="Generate, lock, fine-tune. Find the combination that feels like you."
    >
      <PaletteGeneratorView />
    </StudioShell>
  );
}
