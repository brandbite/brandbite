"use client";

// -----------------------------------------------------------------------------
// @file: components/moodboard/card-wrapper.tsx
// @purpose: The frame around a moodboard object: position, selection outline,
//           resize handles, arrow connectors and its floating toolbar. It holds
//           no pointer logic; BoardCanvas handles all gestures in one place,
//           reading the data attributes set here.
// -----------------------------------------------------------------------------

import React, { memo } from "react";

import type { Side } from "./connection-routing";

export type ResizeCorner = "nw" | "ne" | "sw" | "se";

type CardWrapperProps = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  selected: boolean;
  /** Stickies, shapes and text draw themselves, with no card around them. */
  bare: boolean;
  label: string;
  registerCard: (node: HTMLDivElement | null) => void;
  /** Extra controls for this object's type, shown when selected. */
  toolbar?: React.ReactNode;
  /** Phones show the toolbar pinned to the screen, since it wouldn't fit here. */
  hideToolbar?: boolean;
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

const INVERSE = "var(--mb-inverse-zoom, 1)";
const CONNECTOR_OFFSET = `calc(-22px * ${INVERSE})`;

const CONNECTORS: { side: Side; style: React.CSSProperties; shift: string }[] = [
  { side: "top", style: { top: CONNECTOR_OFFSET, left: "50%" }, shift: "-50%, -50%" },
  { side: "right", style: { right: CONNECTOR_OFFSET, top: "50%" }, shift: "50%, -50%" },
  { side: "bottom", style: { bottom: CONNECTOR_OFFSET, left: "50%" }, shift: "-50%, 50%" },
  { side: "left", style: { left: CONNECTOR_OFFSET, top: "50%" }, shift: "-50%, -50%" },
];

function CardWrapperBase({
  id,
  x,
  y,
  width,
  height,
  selected,
  bare,
  label,
  registerCard,
  toolbar,
  hideToolbar = false,
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
      className={`group absolute cursor-default outline-none ${selected ? "z-30" : ""} ${bare ? "" : "rounded-2xl"}`}
      style={{ left: x, top: y, width, ...(height > 0 ? { height } : {}) }}
    >
      <div
        className={
          bare
            ? `h-full ${selected ? "" : "[&_iframe]:pointer-events-none"}`
            : `h-full overflow-hidden rounded-2xl border bg-[var(--av2-surface)] shadow-[0_1px_2px_rgba(0,0,0,0.06)] transition-[border-color] duration-150 ${
                selected
                  ? "border-transparent [&_iframe]:pointer-events-auto"
                  : "border-[var(--av2-border)] group-hover:border-[var(--av2-accent)] [&_iframe]:pointer-events-none"
              }`
        }
      >
        {children}
      </div>

      {selected && (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              borderRadius: bare ? 4 : 16,
              boxShadow: `0 0 0 calc(2px * ${INVERSE}) var(--av2-accent)`,
            }}
          />

          {CORNERS.map(({ corner, className }) => (
            <div key={corner} aria-hidden className={`absolute z-10 ${className}`}>
              {/* The grab area is larger than what's drawn, for fingers. */}
              <div
                data-mb-handle={corner}
                className="flex h-7 w-7 items-center justify-center"
                style={{ touchAction: "none", transform: `scale(${INVERSE})` }}
              >
                <span className="h-3 w-3 rounded-[3px] border-2 border-[var(--av2-accent)] bg-[var(--av2-surface)]" />
              </div>
            </div>
          ))}

          {CONNECTORS.map(({ side, style, shift }) => (
            <div
              key={side}
              aria-hidden
              data-mb-connector={side}
              className="absolute z-10 flex h-7 w-7 cursor-crosshair items-center justify-center"
              style={{
                ...style,
                touchAction: "none",
                transform: `translate(${shift}) scale(${INVERSE})`,
              }}
            >
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--av2-accent)] transition-transform hover:scale-150" />
            </div>
          ))}

          {!hideToolbar && (
            <div
              data-mb-card-toolbar
              // The padding lifts the toolbar clear of the top connector, so it must not catch
              // clicks, or that connector stops working.
              className="pointer-events-none absolute bottom-full left-1/2 z-20 pb-9"
              style={{
                transform: `translateX(-50%) scale(${INVERSE})`,
                transformOrigin: "50% 100%",
              }}
            >
              <div className="pointer-events-auto flex items-center gap-1 rounded-xl border border-[var(--av2-border)] bg-[var(--av2-surface)] p-1 whitespace-nowrap shadow-md">
                {toolbar}
                <button
                  type="button"
                  onClick={() => onDelete(id)}
                  aria-label={`Delete ${label}`}
                  className="flex h-9 items-center rounded-lg px-3 text-sm font-medium text-[var(--av2-error-text)] hover:bg-[var(--av2-bg)] focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none"
                >
                  Delete
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export const CardWrapper = memo(CardWrapperBase);
