// -----------------------------------------------------------------------------
// @file: components/colors/palette-display.tsx
// @purpose: Render a palette as a row/grid of ColorCards, with an export bar
//           (copy all hex / copy CSS) and a slot for a session-gated Save button.
// -----------------------------------------------------------------------------

"use client";

import type { Palette } from "@/lib/colors";
import { paletteToCss, paletteToHexList } from "@/lib/colors";
import { ColorCard } from "./color-card";
import { Button } from "@/components/ui/button";
import { useClipboard } from "@/components/hooks/use-clipboard";

export function PaletteDisplay({
  palette,
  layout = "grid",
  onToggleLock,
  exportActions = true,
  savedSlot,
}: {
  palette: Palette;
  layout?: "row" | "grid";
  onToggleLock?: (index: number) => void;
  exportActions?: boolean;
  savedSlot?: React.ReactNode;
}) {
  const { copy, isCopied } = useClipboard();

  if (palette.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-[var(--bb-border)] bg-[var(--bb-bg-warm)] px-6 py-10 text-center text-sm text-[var(--bb-text-tertiary)]">
        No colors yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div
        className={
          layout === "row"
            ? "flex flex-wrap gap-3"
            : "grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
        }
      >
        {palette.map((color, i) => (
          <div key={`${color.hex}-${i}`} className={layout === "row" ? "w-32" : ""}>
            <ColorCard
              color={color}
              locked={color.locked}
              onToggleLock={onToggleLock ? () => onToggleLock(i) : undefined}
            />
          </div>
        ))}
      </div>

      {exportActions ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void copy(paletteToHexList(palette), "all-hex")}
          >
            {isCopied("all-hex") ? "Copied!" : "Copy all HEX"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void copy(paletteToCss(palette), "all-css")}
          >
            {isCopied("all-css") ? "Copied!" : "Copy as CSS"}
          </Button>
          {savedSlot}
        </div>
      ) : null}
    </div>
  );
}
