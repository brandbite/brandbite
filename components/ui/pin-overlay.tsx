// -----------------------------------------------------------------------------
// @file: components/ui/pin-overlay.tsx
// @purpose: Renders numbered pin markers on top of an image (edit, readonly, resolve)
// -----------------------------------------------------------------------------

"use client";

import React, { useCallback, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Shared types (exported for use in sidebar + lightbox)
// ---------------------------------------------------------------------------

export type PinData = {
  id?: string;
  x: number; // 0..1 normalized
  y: number; // 0..1 normalized
  order: number;
  label: string;
  status?: "OPEN" | "RESOLVED";
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type PinOverlayProps = {
  /** The image element (rendered via children) */
  children: React.ReactNode;
  pins: PinData[];
  mode: "edit" | "readonly";
  activePinOrder: number | null;
  onPinClick?: (pin: PinData) => void;
  /** Fired when user clicks on the image (not on a pin). x,y are normalized 0..1 */
  onImageClick?: (x: number, y: number) => void;
  /** When true, OPEN pins show a green hover ring to indicate they can be resolved */
  resolveMode?: boolean;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PinOverlay({
  children,
  pins,
  mode,
  activePinOrder,
  onPinClick,
  onImageClick,
  resolveMode,
}: PinOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [longPressPin, setLongPressPin] = useState<number | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleContainerClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (mode !== "edit" || !onImageClick) return;

      // Only fire if clicking the container/image, not a pin
      const target = e.target as HTMLElement;
      if (target.closest("[data-pin]")) return;

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const y = Math.max(
        0,
        Math.min(1, (e.clientY - rect.top) / rect.height),
      );

      onImageClick(x, y);
    },
    [mode, onImageClick],
  );

  // Touch support for mobile
  const handleTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (mode !== "edit" || !onImageClick) return;

      const target = e.target as HTMLElement;
      if (target.closest("[data-pin]")) return;

      // Clear any long-press timer
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }

      const touch = e.changedTouches[0];
      if (!touch) return;

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = Math.max(
        0,
        Math.min(1, (touch.clientX - rect.left) / rect.width),
      );
      const y = Math.max(
        0,
        Math.min(1, (touch.clientY - rect.top) / rect.height),
      );

      onImageClick(x, y);
    },
    [mode, onImageClick],
  );

  // Long-press on pin for mobile tooltip
  const handlePinTouchStart = useCallback(
    (pin: PinData) => {
      longPressTimer.current = setTimeout(() => {
        setLongPressPin(pin.order);
      }, 500);
    },
    [],
  );

  const handlePinTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    // Clear tooltip after a delay
    setTimeout(() => setLongPressPin(null), 2000);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative select-none ${mode === "edit" ? "cursor-crosshair" : ""}`}
      style={{ touchAction: "pinch-zoom" }}
      onClick={handleContainerClick}
      onTouchEnd={handleTouchEnd}
    >
      {children}

      {/* Pin markers */}
      {pins.map((pin) => {
        const isActive = activePinOrder === pin.order;
        const isResolved = pin.status === "RESOLVED";

        return (
          <div
            key={`pin-${pin.order}`}
            data-pin
            className={`absolute z-10 flex items-center justify-center rounded-full font-bold text-white shadow-lg transition-all
              ${isResolved ? "bg-[#32b37b]" : "bg-[#f15b2b]"}
              ${isActive ? "ring-2 ring-white ring-offset-1 ring-offset-transparent animate-pin-pulse md:h-7 md:w-7 h-6 w-6" : "md:h-6 md:w-6 h-5 w-5"}
              ${mode === "edit" ? "cursor-pointer hover:scale-110" : ""}
              ${resolveMode && !isResolved ? "cursor-pointer hover:scale-110 hover:ring-2 hover:ring-[#32b37b]/40" : ""}
              ${!resolveMode && mode !== "edit" ? "cursor-default" : ""}
              animate-pin-drop
            `}
            style={{
              left: `${pin.x * 100}%`,
              top: `${pin.y * 100}%`,
              transform: "translate(-50%, -50%)",
            }}
            onClick={(e) => {
              e.stopPropagation();
              onPinClick?.(pin);
            }}
            onTouchStart={() => handlePinTouchStart(pin)}
            onTouchEnd={handlePinTouchEnd}
          >
            <span className="text-[9px] leading-none md:text-[10px]">
              {isResolved ? "✓" : pin.order}
            </span>

            {/* Mobile long-press tooltip */}
            {longPressPin === pin.order && pin.label && (
              <div className="absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-[#424143] px-2.5 py-1.5 text-[10px] font-normal text-white shadow-lg md:hidden">
                <div className="max-w-[200px] truncate">{pin.label}</div>
                <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-[#424143]" />
              </div>
            )}
          </div>
        );
      })}

      {/* Desktop hover tooltips for readonly mode */}
      {mode === "readonly" &&
        pins.map((pin) => (
          <div
            key={`tooltip-${pin.order}`}
            className="pointer-events-none absolute z-20 hidden group-hover/pin:block"
            style={{
              left: `${pin.x * 100}%`,
              top: `${pin.y * 100}%`,
            }}
          />
        ))}
    </div>
  );
}
