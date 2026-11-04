// -----------------------------------------------------------------------------
// @file: components/colors/studio/color-page-actions.tsx
// @purpose: Interactive parts of the server-rendered color and palette pages:
//           copying values and moving a color or palette into the tools.
// -----------------------------------------------------------------------------

"use client";

import {
  clonePaletteWithNewIds,
  createStudioPalette,
  formatHex,
  studioPaletteToCss,
  suggestPairings,
  type StudioPalette,
} from "@/lib/colors";

import { usePaletteOpener } from "./open-palette";
import { CopyRow, SavePaletteAction } from "./palette-parts";
import { StudioButton } from "./studio-button";
import { StudioSwatch } from "./studio-swatch";
import { useSavedPalettes } from "./use-saved-palettes";
import { useStudioCopy } from "./use-studio-copy";

export function ColorValues({ hex, rgb, hsl }: { hex: string; rgb: string; hsl: string }) {
  return (
    <div className="rounded-[10px] border border-[var(--cs-border)] px-3">
      <CopyRow label="HEX" value={hex} />
      <CopyRow label="RGB" value={rgb} />
      <CopyRow label="HSL" value={hsl} />
    </div>
  );
}

export function ColorActions({ hex, name }: { hex: string; name: string }) {
  const store = useSavedPalettes();
  const opener = usePaletteOpener(async (active) => (await store.save(active)).ok);

  const open = (href: string, hexes: string[]) =>
    opener.requestOpen(
      createStudioPalette({ name: `${name} palette`, hexes, sourceTool: "meanings" }),
      href,
    );

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <StudioButton
        onClick={() => open("/colors/color-palette-generator", [hex, ...suggestPairings(hex)])}
      >
        Build a palette
      </StudioButton>
      <StudioButton
        variant="secondary"
        onClick={() => open("/colors/tailwind-color-generator", [hex])}
      >
        Create shades
      </StudioButton>
      <StudioButton variant="secondary" onClick={() => open("/colors/contrast-checker", [hex])}>
        Check contrast
      </StudioButton>
      {opener.dialog}
    </div>
  );
}

export function PaletteSwatches({ hexes }: { hexes: string[] }) {
  return (
    <ul className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3">
      {hexes.map((hex, index) => (
        <li key={`${hex}-${index}`} className="min-w-0">
          <StudioSwatch hex={hex} />
        </li>
      ))}
    </ul>
  );
}

export function PaletteActions({ palette }: { palette: StudioPalette }) {
  const store = useSavedPalettes();
  const { copy } = useStudioCopy();
  const opener = usePaletteOpener(async (active) => (await store.save(active)).ok);

  return (
    <div className="mt-6 flex flex-wrap gap-2">
      <StudioButton
        onClick={() =>
          opener.requestOpen(clonePaletteWithNewIds(palette), "/colors/color-palette-generator")
        }
      >
        Open in generator
      </StudioButton>
      <StudioButton
        variant="secondary"
        onClick={() =>
          void copy(
            palette.colors.map((c) => formatHex(c.hex)).join(", "),
            "hex-list",
            "all HEX values",
          )
        }
      >
        Copy HEX
      </StudioButton>
      <StudioButton
        variant="secondary"
        onClick={() => void copy(studioPaletteToCss(palette), "css", "CSS variables")}
      >
        Copy CSS
      </StudioButton>
      <SavePaletteAction palette={clonePaletteWithNewIds(palette)} store={store} />
      <StudioButton
        variant="secondary"
        onClick={() =>
          opener.requestOpen(clonePaletteWithNewIds(palette), "/colors/contrast-checker")
        }
      >
        Check contrast
      </StudioButton>
      {opener.dialog}
    </div>
  );
}
