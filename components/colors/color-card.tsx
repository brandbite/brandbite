// -----------------------------------------------------------------------------
// @file: components/colors/color-card.tsx
// @purpose: A color with its HEX/RGB/HSL values and copy-to-clipboard buttons
//           for each representation. Optional lock toggle for the generator.
// -----------------------------------------------------------------------------

"use client";

import type { PaletteColor } from "@/lib/colors";
import { formatHex, formatHsl, formatRgb, readableTextOn } from "@/lib/colors";
import { useClipboard } from "@/components/hooks/use-clipboard";

type Row = { label: string; value: string };

export function ColorCard({
  color,
  locked,
  onToggleLock,
}: {
  color: PaletteColor;
  locked?: boolean;
  onToggleLock?: () => void;
}) {
  const { copy, isCopied } = useClipboard();
  const hex = formatHex(color.hex);
  const text = readableTextOn(hex);

  const rows: Row[] = [
    { label: "HEX", value: hex },
    { label: "RGB", value: formatRgb(color.rgb) },
    { label: "HSL", value: formatHsl(color.hsl) },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-card)]">
      <div
        className="relative flex h-24 items-end justify-end p-2"
        style={{ backgroundColor: hex, color: text }}
      >
        {onToggleLock ? (
          <button
            type="button"
            onClick={onToggleLock}
            aria-pressed={locked}
            aria-label={locked ? "Unlock color" : "Lock color"}
            title={locked ? "Unlock" : "Lock"}
            className="rounded-full bg-black/10 px-2 py-1 text-xs font-semibold backdrop-blur-sm transition-colors hover:bg-black/20"
          >
            {locked ? "🔒" : "🔓"}
          </button>
        ) : null}
      </div>
      <div className="divide-y divide-[var(--bb-border-subtle)]">
        {rows.map((row) => {
          const copied = isCopied(`${hex}-${row.label}`);
          return (
            <button
              key={row.label}
              type="button"
              onClick={() => void copy(row.value, `${hex}-${row.label}`)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-[var(--bb-bg-warm)] focus-visible:bg-[var(--bb-bg-warm)] focus-visible:outline-none"
            >
              <span className="text-[10px] font-semibold tracking-wide text-[var(--bb-text-tertiary)] uppercase">
                {row.label}
              </span>
              <span className="font-mono text-xs text-[var(--bb-secondary)]">
                {copied ? "Copied!" : row.value}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
