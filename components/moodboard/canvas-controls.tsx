"use client";

import React from "react";

type CanvasControlsProps = {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onFitToContent: () => void;
};

export function CanvasControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onReset,
  onFitToContent,
}: CanvasControlsProps) {
  const pct = Math.round(zoom * 100);

  return (
    <div className="fixed right-8 bottom-4 z-50 flex items-center gap-1 rounded-xl border border-[var(--bb-border)] bg-white px-1 py-1 shadow-md">
      <button
        onClick={onZoomOut}
        className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--bb-text-secondary)] hover:bg-gray-100"
        title="Zoom out"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M3 7H11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      <button
        onClick={onReset}
        className="min-w-[44px] rounded-lg px-1 py-1 text-center text-xs font-medium text-[var(--bb-secondary)] hover:bg-gray-100"
        title="Reset zoom to 100%"
      >
        {pct}%
      </button>

      <button
        onClick={onZoomIn}
        className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--bb-text-secondary)] hover:bg-gray-100"
        title="Zoom in"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 3V11M3 7H11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      <div className="mx-0.5 h-5 w-px bg-gray-200" />

      <button
        onClick={onFitToContent}
        className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--bb-text-secondary)] hover:bg-gray-100"
        title="Fit to content"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d="M1 5V2.5C1 1.67 1.67 1 2.5 1H5M9 1H11.5C12.33 1 13 1.67 13 2.5V5M13 9V11.5C13 12.33 12.33 13 11.5 13H9M5 13H2.5C1.67 13 1 12.33 1 11.5V9"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}
