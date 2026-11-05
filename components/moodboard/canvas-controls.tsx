"use client";

import React, { useSyncExternalStore } from "react";

import type { CanvasController } from "./use-canvas-transform";

type CanvasControlsProps = {
  canvas: CanvasController;
  hasItems: boolean;
  onFitToContent: () => void;
};

const BUTTON =
  "flex h-10 items-center justify-center rounded-lg text-[var(--av2-text)] hover:bg-[var(--av2-bg)] focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none disabled:opacity-40";

export function CanvasControls({ canvas, hasItems, onFitToContent }: CanvasControlsProps) {
  // The only part of the canvas that re-renders while zooming.
  const zoom = useSyncExternalStore(canvas.subscribeZoom, canvas.getZoom, canvas.getZoom);

  return (
    <div className="absolute top-16 right-3 z-20 flex items-center gap-1 rounded-xl border border-[var(--av2-border)] bg-[var(--av2-surface)] p-1 shadow-sm">
      <button
        type="button"
        onClick={canvas.zoomOut}
        className={`${BUTTON} w-10 max-md:hidden`}
        aria-label="Zoom out"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
          <path d="M3 7H11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      <button
        type="button"
        onClick={canvas.resetZoom}
        className={`${BUTTON} min-w-14 px-2 text-sm font-medium tabular-nums`}
        aria-label={`Zoom ${Math.round(zoom * 100)}%. Reset to 100%`}
      >
        {Math.round(zoom * 100)}%
      </button>

      <button
        type="button"
        onClick={canvas.zoomIn}
        className={`${BUTTON} w-10 max-md:hidden`}
        aria-label="Zoom in"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
          <path d="M7 3V11M3 7H11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      <div aria-hidden className="mx-1 h-5 w-px bg-[var(--av2-border)]" />

      <button
        type="button"
        onClick={onFitToContent}
        disabled={!hasItems}
        aria-label="Fit to content"
        className={`${BUTTON} gap-2 px-3 text-sm font-medium`}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
          <path
            d="M1 5V2.5C1 1.67 1.67 1 2.5 1H5M9 1H11.5C12.33 1 13 1.67 13 2.5V5M13 9V11.5C13 12.33 12.33 13 11.5 13H9M5 13H2.5C1.67 13 1 12.33 1 11.5V9"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="hidden sm:inline">Fit to content</span>
      </button>
    </div>
  );
}
