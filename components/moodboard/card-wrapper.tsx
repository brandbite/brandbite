"use client";

// -----------------------------------------------------------------------------
// @file: components/moodboard/card-wrapper.tsx
// @purpose: The frame around a moodboard card: position, selection outline,
//           resize handles and the delete button. It holds no pointer logic;
//           BoardCanvas handles dragging for all cards from one place, reading
//           the data attributes set here.
// -----------------------------------------------------------------------------

import React, { memo } from "react";

export type ResizeCorner = "nw" | "ne" | "sw" | "se";

type CardWrapperProps = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  selected: boolean;
  label: string;
  registerCard: (node: HTMLDivElement | null) => void;
  onDelete: (id: string) => void;
  children: React.ReactNode;
};

const CORNERS: { corner: ResizeCorner; className: string }[] = [
  { corner: "nw", className: "left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize" },
  { corner: "ne", className: "right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize" },
  {
    corner: "sw",
    className: "left-0 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize",
  },
  {
    corner: "se",
    className: "right-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize",
  },
];

function CardWrapperBase({
  id,
  x,
  y,
  width,
  height,
  selected,
  label,
  registerCard,
  onDelete,
  children,
}: CardWrapperProps) {
  return (
    <div
      ref={registerCard}
      data-mb-card-id={id}
      role="group"
      aria-label={label}
      tabIndex={0}
      className={`group absolute cursor-default rounded-2xl outline-none ${selected ? "z-30" : ""}`}
      style={{ left: x, top: y, width, ...(height > 0 ? { height } : {}) }}
    >
      <div
        className={`h-full overflow-hidden rounded-2xl border bg-[var(--av2-surface)] shadow-[0_1px_2px_rgba(0,0,0,0.06)] transition-[border-color,box-shadow] duration-150 ${
          selected
            ? "border-transparent [&_iframe]:pointer-events-auto"
            : "border-[var(--av2-border)] group-hover:border-[var(--av2-accent)] [&_iframe]:pointer-events-none"
        }`}
      >
        {children}
      </div>

      {selected && (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-2xl"
            style={{
              boxShadow:
                "0 0 0 calc(2px * var(--mb-inverse-zoom, 1)) var(--av2-accent), 0 8px 24px rgba(0,0,0,0.12)",
            }}
          />

          {CORNERS.map(({ corner, className }) => (
            <div key={corner} aria-hidden className={`absolute z-10 ${className}`}>
              <div
                data-mb-handle={corner}
                className="rounded-[3px] border-2 border-[var(--av2-accent)] bg-[var(--av2-surface)]"
                style={{
                  width: 12,
                  height: 12,
                  touchAction: "none",
                  transform: "scale(var(--mb-inverse-zoom, 1))",
                }}
              />
            </div>
          ))}

          <div
            className="absolute right-0 bottom-full z-10 pb-2"
            style={{ transform: "scale(var(--mb-inverse-zoom, 1))", transformOrigin: "100% 100%" }}
          >
            <button
              type="button"
              onClick={() => onDelete(id)}
              aria-label={`Delete ${label}`}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-[var(--av2-border)] bg-[var(--av2-surface)] px-3 text-sm font-medium text-[var(--av2-error-text)] shadow-sm hover:bg-[var(--av2-bg)] focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none"
            >
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export const CardWrapper = memo(CardWrapperBase);
