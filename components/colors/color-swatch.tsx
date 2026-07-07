// -----------------------------------------------------------------------------
// @file: components/colors/color-swatch.tsx
// @purpose: A single color chip. Optionally click-to-copy its hex, with a
//           legible check overlay chosen for contrast.
// -----------------------------------------------------------------------------

"use client";

import { readableTextOn, formatHex } from "@/lib/colors";
import { useClipboard } from "@/components/hooks/use-clipboard";

type Size = "sm" | "md" | "lg";

const SIZE: Record<Size, string> = {
  sm: "h-8 w-8",
  md: "h-12 w-12",
  lg: "h-16 w-16",
};

export function ColorSwatch({
  hex,
  size = "md",
  selected = false,
  copyOnClick = false,
  onClick,
  ariaLabel,
}: {
  hex: string;
  size?: Size;
  selected?: boolean;
  copyOnClick?: boolean;
  onClick?: (hex: string) => void;
  ariaLabel?: string;
}) {
  const { copy, isCopied } = useClipboard();
  const display = formatHex(hex);
  const copied = isCopied(display);

  return (
    <button
      type="button"
      aria-label={ariaLabel ?? `Color ${display}`}
      title={display}
      onClick={() => {
        if (copyOnClick) void copy(display, display);
        onClick?.(hex);
      }}
      style={{ backgroundColor: display, color: readableTextOn(display) }}
      className={`flex ${SIZE[size]} items-center justify-center rounded-xl border shadow-sm transition-transform outline-none hover:scale-105 focus-visible:ring-2 focus-visible:ring-[var(--bb-primary)] ${
        selected ? "border-[var(--bb-primary)] ring-2 ring-[var(--bb-primary)]" : "border-black/10"
      }`}
    >
      {copied ? <span className="text-xs font-bold">✓</span> : null}
    </button>
  );
}
