// -----------------------------------------------------------------------------
// @file: components/colors/studio/palette-preview.tsx
// @purpose: Sample landing page drawn from a palette's roles, with a hills-and-sun
//           illustration in the palette's own colors. Button text color is
//           computed, and a low text contrast is called out rather than implied
//           to be fine.
// -----------------------------------------------------------------------------

import {
  contrastRatio,
  formatContrastRatio,
  hexToRgb,
  readableTextOn,
  relativeLuminance,
  resolvePaletteColors,
  type StudioPalette,
} from "@/lib/colors";

export function PalettePreview({ palette }: { palette: StudioPalette }) {
  const colors = resolvePaletteColors(palette);
  const textRatio = contrastRatio(colors.text, colors.background);

  const byLuminance = palette.colors
    .map((c) => c.hex)
    .sort((a, b) => relativeLuminance(hexToRgb(a)) - relativeLuminance(hexToRgb(b)));
  const middleHill = byLuminance[Math.floor(byLuminance.length / 2)];
  const backHill = byLuminance[Math.min(byLuminance.length - 1, Math.ceil(byLuminance.length / 2))];
  const dots = palette.colors.slice(0, 3);

  return (
    <div>
      <div
        role="img"
        aria-label={`Sample landing page using the ${palette.name} palette`}
        className="overflow-hidden rounded-2xl border border-[var(--cs-border)] p-5"
        style={{ backgroundColor: colors.background, color: colors.text }}
      >
        <div className="flex items-center justify-between gap-3 text-xs leading-4">
          <span className="flex items-center gap-2 text-sm leading-5 font-bold">
            <span
              className="h-5 w-5 rounded-[6px_12px_6px_12px]"
              style={{ backgroundColor: colors.primary }}
            />
            Acme Studio
          </span>
          <span className="flex items-center gap-3 font-medium max-[479px]:hidden">
            <span>Home</span>
            <span>Features</span>
            <span>Pricing</span>
            <span
              className="rounded-md px-2.5 py-1 font-semibold"
              style={{ backgroundColor: colors.accent, color: readableTextOn(colors.accent) }}
            >
              Get started
            </span>
          </span>
        </div>

        <div className="mt-6 grid grid-cols-2 items-center gap-4 max-[479px]:grid-cols-1">
          <div className="min-w-0">
            <p className="text-2xl leading-7 font-bold">
              Design ideas that <span style={{ color: colors.accent }}>take shape.</span>
            </p>
            <p className="mt-2 text-sm leading-5">
              A creative workspace for modern brands, teams, and ideas.
            </p>
            <span
              className="mt-4 inline-block rounded-lg px-4 py-2 text-sm leading-5 font-semibold"
              style={{ backgroundColor: colors.primary, color: colors.onPrimary }}
            >
              Start for free
            </span>
            <span className="mt-4 flex gap-1.5">
              {dots.map((dot) => (
                <span
                  key={dot.id}
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: dot.hex }}
                />
              ))}
            </span>
          </div>
          <svg
            aria-hidden="true"
            viewBox="0 0 200 150"
            preserveAspectRatio="xMidYMid slice"
            className="block h-36 w-full rounded-xl"
          >
            <rect width="200" height="150" fill={colors.surface} />
            <circle cx="150" cy="44" r="20" fill={colors.accent} />
            <path d="M0 96 C30 70 56 66 88 88 C118 108 150 74 200 90 V150 H0 Z" fill={backHill} />
            <path
              d="M0 116 C36 92 70 96 104 112 C136 128 166 102 200 112 V150 H0 Z"
              fill={middleHill}
            />
            <path
              d="M0 134 C44 116 84 124 120 134 C150 142 176 128 200 132 V150 H0 Z"
              fill={colors.primary}
            />
          </svg>
        </div>
      </div>
      <p className="mt-2 text-sm leading-5 text-[var(--cs-muted)]">
        Text on background: {formatContrastRatio(textRatio)}
        {textRatio < 4.5 ? " (below AA for normal text)" : ""}
      </p>
    </div>
  );
}
