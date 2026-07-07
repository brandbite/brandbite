// -----------------------------------------------------------------------------
// @file: components/colors/wheel-interactive.tsx
// @purpose: Interactive HSL color wheel. Angle = hue, radius = saturation (at a
//           fixed lightness). Dragging the handle updates hue/saturation; the
//           companion dots show where the current harmony's colors land.
//
// Implementation note: uses native pointer events + setPointerCapture rather
// than @dnd-kit. A wheel is a continuous radial control — mapping absolute
// pointer coords through atan2 (hue) and radius (saturation) is exact and
// simpler than dnd-kit's delta-transform model, which targets list/grid DnD.
// Keyboard support (arrows) is provided directly for a11y.
// -----------------------------------------------------------------------------

"use client";

import { useCallback, useRef } from "react";
import { clampPct, harmony, hslToHex, readableTextOn, wrapHue } from "@/lib/colors";
import type { HarmonyKind } from "@/lib/colors";

export function WheelInteractive({
  hue,
  saturation,
  lightness = 50,
  harmonyKind,
  onChange,
  size = 320,
}: {
  hue: number;
  saturation: number;
  lightness?: number;
  harmonyKind?: HarmonyKind;
  onChange: (next: { hue: number; saturation: number }) => void;
  size?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const radius = size / 2;

  const updateFromPoint = useCallback(
    (clientX: number, clientY: number) => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = clientX - cx;
      const dy = clientY - cy;
      // atan2 with screen y flipped so 0° points right and hue rotates CCW-up.
      const angle = wrapHue((Math.atan2(-dy, dx) * 180) / Math.PI);
      const dist = Math.min(1, Math.hypot(dx, dy) / (rect.width / 2));
      onChange({ hue: angle, saturation: clampPct(dist * 100) });
    },
    [onChange],
  );

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    updateFromPoint(e.clientX, e.clientY);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) updateFromPoint(e.clientX, e.clientY);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    let dh = 0;
    let ds = 0;
    if (e.key === "ArrowLeft") dh = -2;
    else if (e.key === "ArrowRight") dh = 2;
    else if (e.key === "ArrowUp") ds = 2;
    else if (e.key === "ArrowDown") ds = -2;
    else return;
    e.preventDefault();
    onChange({ hue: wrapHue(hue + dh), saturation: clampPct(saturation + ds) });
  };

  // Handle position: polar (hue angle, saturation radius) -> cartesian.
  const handlePos = (h: number, s: number) => {
    const rad = (h * Math.PI) / 180;
    const r = (s / 100) * radius;
    return { left: radius + Math.cos(rad) * r, top: radius - Math.sin(rad) * r };
  };

  const main = handlePos(hue, saturation);
  const mainHex = hslToHex({ h: hue, s: saturation, l: lightness });

  const companions =
    harmonyKind && harmonyKind !== "monochromatic"
      ? harmony(harmonyKind, { h: hue, s: saturation, l: lightness }).slice(1)
      : [];

  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label="Color wheel: hue and saturation"
      aria-valuetext={`Hue ${Math.round(hue)} degrees, saturation ${Math.round(saturation)} percent`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onKeyDown={onKeyDown}
      className="relative touch-none rounded-full shadow-inner outline-none select-none focus-visible:ring-2 focus-visible:ring-[var(--bb-primary)] focus-visible:ring-offset-2"
      style={{
        width: size,
        height: size,
        // Hue ring (conic) + saturation falloff to white in the center.
        background: `radial-gradient(circle at center, #ffffff 0%, transparent 70%), conic-gradient(from 90deg, hsl(0,100%,50%), hsl(60,100%,50%), hsl(120,100%,50%), hsl(180,100%,50%), hsl(240,100%,50%), hsl(300,100%,50%), hsl(360,100%,50%))`,
      }}
    >
      {companions.map((c, i) => {
        const pos = handlePos(c.hsl.h, c.hsl.s);
        return (
          <span
            key={i}
            className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
            style={{ left: pos.left, top: pos.top, backgroundColor: c.hex }}
          />
        );
      })}

      <span
        className="pointer-events-none absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white shadow-lg"
        style={{
          left: main.left,
          top: main.top,
          backgroundColor: mainHex,
          color: readableTextOn(mainHex),
        }}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
      </span>
    </div>
  );
}
