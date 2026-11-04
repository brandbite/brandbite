// -----------------------------------------------------------------------------
// @file: app/colors/contrast-checker/page.tsx
// @purpose: WCAG text contrast checker.
// -----------------------------------------------------------------------------

import { ContrastCheckerView } from "@/components/colors/studio/contrast-checker-view";
import { StudioShell } from "@/components/colors/studio/studio-shell";

export default function ContrastCheckerPage() {
  return (
    <StudioShell
      title="Make every word"
      accent="readable."
      blurb="Check a color pairing before it becomes a design decision."
      breadcrumb="Contrast checker"
    >
      <ContrastCheckerView />
    </StudioShell>
  );
}
