// -----------------------------------------------------------------------------
// @file: app/colors/gradient-generator/page.tsx
// @purpose: CSS gradient generator with a PNG download.
// -----------------------------------------------------------------------------

import { GradientGeneratorView } from "@/components/colors/studio/gradient-generator-view";
import { StudioShell } from "@/components/colors/studio/studio-shell";

export default function GradientGeneratorPage() {
  return (
    <StudioShell
      title="Blend your colors into a"
      accent="gradient."
      blurb="Set the colors and the angle, copy the CSS or download the image."
      breadcrumb="Gradient generator"
    >
      <GradientGeneratorView />
    </StudioShell>
  );
}
