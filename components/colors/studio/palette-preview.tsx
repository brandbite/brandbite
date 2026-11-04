// -----------------------------------------------------------------------------
// @file: components/colors/studio/palette-preview.tsx
// @purpose: Sample landing page drawn from a palette's roles. Button text color is
//           computed, and a low text contrast is called out rather than implied
//           to be fine.
// -----------------------------------------------------------------------------

import {
  contrastRatio,
  formatContrastRatio,
  readableTextOn,
  resolvePaletteColors,
  type StudioPalette,
} from "@/lib/colors";

export function PalettePreview({ palette }: { palette: StudioPalette }) {
  const colors = resolvePaletteColors(palette);
  const textRatio = contrastRatio(colors.text, colors.background);

  return (
    <div>
      <div
        role="img"
        aria-label={`Sample landing page using the ${palette.name} palette`}
        className="overflow-hidden rounded-2xl border border-[var(--cs-border)] p-5"
        style={{ backgroundColor: colors.background, color: colors.text }}
      >
        <div className="flex items-center justify-between gap-3 text-sm leading-5">
          <span className="font-semibold">Acme Studio</span>
          <span
            className="rounded-lg px-3 py-1 font-semibold"
            style={{ backgroundColor: colors.accent, color: readableTextOn(colors.accent) }}
          >
            Get started
          </span>
        </div>
        <div className="mt-6 grid grid-cols-2 items-center gap-4 max-[479px]:grid-cols-1">
          <div>
            <p className="text-2xl leading-8 font-bold">Design ideas that take shape.</p>
            <p className="mt-2 text-sm leading-5">
              A creative workspace for modern brands, teams, and ideas.
            </p>
            <span
              className="mt-4 inline-block rounded-lg px-4 py-2 text-sm leading-5 font-semibold"
              style={{ backgroundColor: colors.primary, color: colors.onPrimary }}
            >
              Start for free
            </span>
          </div>
          <div
            className="relative h-32 overflow-hidden rounded-xl"
            style={{ backgroundColor: colors.surface }}
          >
            <span
              className="absolute top-4 right-5 h-8 w-8 rounded-full"
              style={{ backgroundColor: colors.accent }}
            />
            <span
              className="absolute -bottom-10 -left-6 h-24 w-40 rounded-[50%]"
              style={{ backgroundColor: colors.primary }}
            />
          </div>
        </div>
      </div>
      <p className="mt-2 text-sm leading-5 text-[var(--cs-muted)]">
        Text on background: {formatContrastRatio(textRatio)}
        {textRatio < 4.5 ? " (below AA for normal text)" : ""}
      </p>
    </div>
  );
}
