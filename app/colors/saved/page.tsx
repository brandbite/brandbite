// -----------------------------------------------------------------------------
// @file: app/colors/saved/page.tsx
// @purpose: Saved palettes across all Color Studio tools.
// -----------------------------------------------------------------------------

import { SavedPalettesView } from "@/components/colors/studio/saved-palettes-view";
import { StudioShell } from "@/components/colors/studio/studio-shell";

export default function SavedPalettesPage() {
  return (
    <StudioShell
      title="Your colors."
      accent="All together."
      blurb="Everything you save across Color Studio, in one place."
      breadcrumb="Saved palettes"
    >
      <SavedPalettesView />
    </StudioShell>
  );
}
