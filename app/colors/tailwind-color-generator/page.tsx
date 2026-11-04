// -----------------------------------------------------------------------------
// @file: app/colors/tailwind-color-generator/page.tsx
// @purpose: Turn a single color into a full Tailwind shade scale (50 to 950).
// -----------------------------------------------------------------------------

import { StudioShell } from "@/components/colors/studio/studio-shell";
import { TailwindShadesView } from "@/components/colors/studio/tailwind-shades-view";

export default function TailwindColorGeneratorPage() {
  return (
    <StudioShell
      title="One color."
      accent="Every shade."
      blurb="Turn a single HEX into a complete shade scale, ready for your next build."
    >
      <TailwindShadesView />
    </StudioShell>
  );
}
