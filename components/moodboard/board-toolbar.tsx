"use client";

import React, { useRef, useState } from "react";
import {
  DRAW_COLORS,
  DRAW_SIZES,
  STICKY_COLORS,
  type PenKind,
  type ShapeKind,
} from "@/lib/moodboard";

import { ShapeOutline } from "./shape-card";

export type ToolMode = "select" | "hand" | "arrow" | "draw" | "eraser";

export type CreatableKind =
  | "note"
  | "shape"
  | "text"
  | "color"
  | "todo"
  | "image"
  | "link"
  | "file"
  | "video";

type BoardToolbarProps = {
  isPhone?: boolean;
  moreOpen?: boolean;
  onSetMoreOpen?: (open: boolean) => void;
  /** Out of the way while the on-screen keyboard is open. */
  hidden?: boolean;
  toolMode: ToolMode;
  /** The object waiting to be placed with the next click on the canvas. */
  placing: CreatableKind | null;
  onSetToolMode: (mode: ToolMode) => void;
  /** Clicked or tapped in the dock. */
  onPick: (kind: CreatableKind) => void;
  /** Dragged out of the dock and let go at this point on screen. */
  onDropAt: (kind: CreatableKind, clientX: number, clientY: number) => void;
  penKind: PenKind;
  drawColor: string;
  drawSize: number;
  shapeKind: ShapeKind;
  onSetPenKind: (kind: PenKind) => void;
  onSetDrawColor: (color: string) => void;
  onSetDrawSize: (size: number) => void;
  onSetShapeKind: (kind: ShapeKind) => void;
};

function SelectIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path
        d="M4 2L4 15L7.5 11.5L11 17L13 16L9.5 10L14 10L4 2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function NoteIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="3" y="2" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <line
        x1="6"
        y1="6"
        x2="14"
        y2="6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="6"
        y1="10"
        x2="14"
        y2="10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="6"
        y1="14"
        x2="10"
        y2="14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="2" y="3" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="7" cy="7.5" r="1.5" fill="currentColor" />
      <path
        d="M2 14L6.5 9.5L10 13L13 10L18 15"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ColorIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="10" cy="6" r="1.5" fill="currentColor" />
      <circle cx="6.5" cy="11.5" r="1.5" fill="currentColor" />
      <circle cx="13.5" cy="11.5" r="1.5" fill="currentColor" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M8.5 11.5L11.5 8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M11.5 13.5L14 11C15.1046 9.89543 15.1046 8.10457 14 7L13 6C11.8954 4.89543 10.1046 4.89543 9 6L6.5 8.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M8.5 6.5L6 9C4.89543 10.1046 4.89543 11.8954 6 13L7 14C8.10457 15.1046 9.89543 15.1046 11 14L13.5 11.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path
        d="M5 3C5 2.44772 5.44772 2 6 2H12L16 6V17C16 17.5523 15.5523 18 15 18H6C5.44772 18 5 17.5523 5 17V3Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M12 2V6H16" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function TodoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="3" y="4" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="3" y="12" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <line
        x1="10"
        y1="6"
        x2="17"
        y2="6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="10"
        y1="14"
        x2="17"
        y2="14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M4 16L16 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M16 4L10 4M16 4L16 10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DrawIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path
        d="M3 17C5 13 7.5 9 10 7C12.5 5 15 4 17 3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function EraserIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M8 17H17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M3.5 13.5L10.5 6.5L15 11L10 16L6.5 16L3.5 13.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M10.5 6.5L15 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function VideoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="2" y="4" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 8V12L12 10L8 8Z" fill="currentColor" />
    </svg>
  );
}

function HandIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path
        d="M6 10V4.5a1.25 1.25 0 012.5 0V9m0-.5V3.25a1.25 1.25 0 012.5 0V9m0-.5V4.25a1.25 1.25 0 012.5 0V10m0-3.5a1.25 1.25 0 012.5 0V12a6 6 0 01-6 6h-.8a5 5 0 01-3.9-1.9L3 12.2a1.3 1.3 0 012-1.6l1 1"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HighlighterIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M3 17h14" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity=".4" />
      <path
        d="M6 13l1-4 6-6 3 3-6 6-4 1z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TextIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path
        d="M4 5V3.5h12V5M10 3.5v13M7.5 16.5h5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ShapeIcon({ kind }: { kind: ShapeKind }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      {kind === "rect" && (
        <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      )}
      {kind === "ellipse" && (
        <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5" />
      )}
      {kind === "diamond" && (
        <path
          d="M10 2l8 8-8 8-8-8 8-8z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

const BUTTON =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none";

function buttonClass(active: boolean) {
  return `${BUTTON} ${
    active
      ? "bg-[var(--av2-selected)] text-[var(--av2-link)]"
      : "text-[var(--av2-text)] hover:bg-[var(--av2-bg)]"
  }`;
}

function Divider() {
  return <div aria-hidden className="mx-1 h-7 w-px shrink-0 self-center bg-[var(--av2-border)]" />;
}

const DRAG_THRESHOLD = 4;

const SHAPE_NAMES: Record<ShapeKind, string> = {
  rect: "Square",
  ellipse: "Circle",
  diamond: "Diamond",
};

/** What follows the pointer while dragging out of the dock. */
function DragGhost({ kind, shapeKind }: { kind: CreatableKind; shapeKind: ShapeKind }) {
  if (kind === "note") {
    return (
      <div
        className="h-32 w-32 rounded-[4px] shadow-lg"
        style={{ backgroundColor: STICKY_COLORS[0] }}
      />
    );
  }
  if (kind === "shape") {
    return (
      <div className="relative h-28 w-28">
        <ShapeOutline kind={shapeKind} fill="#FFFFFF" />
      </div>
    );
  }
  const labels: Partial<Record<CreatableKind, string>> = {
    text: "Text",
    color: "Color",
    todo: "Checklist",
    image: "Image",
    link: "Link",
    file: "File",
    video: "Video",
  };
  return (
    <div className="rounded-xl border border-[var(--av2-border)] bg-[var(--av2-surface)] px-4 py-3 text-sm font-medium text-[var(--av2-text)] shadow-lg">
      {labels[kind]}
    </div>
  );
}

export function BoardToolbar({
  isPhone = false,
  moreOpen = false,
  onSetMoreOpen,
  hidden = false,
  toolMode,
  placing,
  onSetToolMode,
  onPick,
  onDropAt,
  penKind,
  drawColor,
  drawSize,
  shapeKind,
  onSetPenKind,
  onSetDrawColor,
  onSetDrawSize,
  onSetShapeKind,
}: BoardToolbarProps) {
  const [ghost, setGhost] = useState<{ kind: CreatableKind; x: number; y: number } | null>(null);
  const justDragged = useRef(false);

  const penOpen = toolMode === "draw" || toolMode === "eraser";

  if (hidden) return null;

  // Mouse only: on touch, a drag along the dock scrolls it, and a tap still works.
  function startDrag(e: React.PointerEvent, kind: CreatableKind) {
    // A drag dropped on the canvas sends no click to this button, so reset here.
    justDragged.current = false;
    if (e.pointerType === "touch" || e.button !== 0) return;
    const startX = e.clientX;
    const startY = e.clientY;
    let dragging = false;

    const onMove = (ev: PointerEvent) => {
      if (!dragging && Math.hypot(ev.clientX - startX, ev.clientY - startY) < DRAG_THRESHOLD)
        return;
      dragging = true;
      setGhost({ kind, x: ev.clientX, y: ev.clientY });
    };
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setGhost(null);
      if (!dragging) return;
      justDragged.current = true;
      onDropAt(kind, ev.clientX, ev.clientY);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function pick(kind: CreatableKind) {
    // The click that ends a drag isn't a click on the button.
    if (justDragged.current) {
      justDragged.current = false;
      return;
    }
    onPick(kind);
  }

  const creator = (
    kind: CreatableKind,
    label: string,
    icon: React.ReactNode,
    shortcut?: string,
  ) => (
    <button
      key={kind}
      type="button"
      aria-label={label}
      aria-pressed={placing === kind}
      title={
        shortcut ? `${label} (${shortcut}) · click to place, or drag` : `${label} · click or drag`
      }
      onPointerDown={(e) => startDrag(e, kind)}
      onClick={() => pick(kind)}
      className={buttonClass(placing === kind)}
    >
      {icon}
    </button>
  );

  const tool = (mode: ToolMode, label: string, icon: React.ReactNode, shortcut: string) => (
    <button
      type="button"
      aria-label={label}
      aria-pressed={toolMode === mode && !placing}
      title={`${label} (${shortcut})`}
      onClick={() => onSetToolMode(mode)}
      className={buttonClass(toolMode === mode && !placing)}
    >
      {icon}
    </button>
  );

  return (
    <>
      <div
        data-mb-dock
        className="absolute bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 z-30 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 flex-col items-center gap-2"
      >
        {penOpen && (
          <div className="flex max-w-full flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-xl border border-[var(--av2-border)] bg-[var(--av2-surface)] p-1 shadow-md">
            <div role="group" aria-label="Pen type" className="flex items-center">
              <button
                type="button"
                aria-label="Marker"
                aria-pressed={toolMode === "draw" && penKind === "marker"}
                title="Marker (M)"
                onClick={() => {
                  onSetPenKind("marker");
                  onSetToolMode("draw");
                }}
                className={buttonClass(toolMode === "draw" && penKind === "marker")}
              >
                <DrawIcon />
              </button>
              <button
                type="button"
                aria-label="Highlighter"
                aria-pressed={toolMode === "draw" && penKind === "highlighter"}
                title="Highlighter"
                onClick={() => {
                  onSetPenKind("highlighter");
                  onSetToolMode("draw");
                }}
                className={buttonClass(toolMode === "draw" && penKind === "highlighter")}
              >
                <HighlighterIcon />
              </button>
              <button
                type="button"
                aria-label="Eraser"
                aria-pressed={toolMode === "eraser"}
                title="Eraser (E)"
                onClick={() => onSetToolMode("eraser")}
                className={buttonClass(toolMode === "eraser")}
              >
                <EraserIcon />
              </button>
            </div>
            <Divider />
            <div role="group" aria-label="Pen color" className="flex items-center">
              {DRAW_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={drawColor === c}
                  aria-label={`Color ${c}`}
                  onClick={() => onSetDrawColor(c)}
                  className="flex h-10 w-9 items-center justify-center rounded-lg hover:bg-[var(--av2-bg)] focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none"
                >
                  <span
                    className={`h-5 w-5 rounded-full ${drawColor === c ? "ring-2 ring-[var(--av2-accent)] ring-offset-2 ring-offset-[var(--av2-surface)]" : ""}`}
                    style={{ backgroundColor: c }}
                  />
                </button>
              ))}
            </div>
            <Divider />
            <div role="group" aria-label="Pen size" className="flex items-center">
              {DRAW_SIZES.map((size) => (
                <button
                  key={size}
                  type="button"
                  aria-pressed={drawSize === size}
                  aria-label={`Size ${size}`}
                  onClick={() => onSetDrawSize(size)}
                  className={`flex h-10 w-9 items-center justify-center rounded-lg focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none ${
                    drawSize === size ? "bg-[var(--av2-selected)]" : "hover:bg-[var(--av2-bg)]"
                  }`}
                >
                  <span
                    className="rounded-full"
                    style={{ width: size + 3, height: size + 3, backgroundColor: drawColor }}
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        {placing === "shape" && (
          <div
            role="group"
            aria-label="Shape"
            className="flex items-center rounded-xl border border-[var(--av2-border)] bg-[var(--av2-surface)] p-1 shadow-md"
          >
            {(Object.keys(SHAPE_NAMES) as ShapeKind[]).map((kind) => (
              <button
                key={kind}
                type="button"
                aria-label={SHAPE_NAMES[kind]}
                aria-pressed={shapeKind === kind}
                onClick={() => onSetShapeKind(kind)}
                className={buttonClass(shapeKind === kind)}
              >
                <ShapeIcon kind={kind} />
              </button>
            ))}
          </div>
        )}

        {isPhone && moreOpen && (
          <div
            role="group"
            aria-label="More items"
            className="flex max-w-full items-center gap-0.5 overflow-x-auto rounded-xl border border-[var(--av2-border)] bg-[var(--av2-surface)] p-1 shadow-md [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            onClick={() => onSetMoreOpen?.(false)}
          >
            {creator("image", "Image", <ImageIcon />)}
            {creator("color", "Color", <ColorIcon />)}
            {creator("todo", "Checklist", <TodoIcon />)}
            {creator("link", "Link", <LinkIcon />)}
            {creator("file", "File", <FileIcon />)}
            {creator("video", "Video", <VideoIcon />)}
          </div>
        )}

        <div
          role="toolbar"
          aria-label="Moodboard tools"
          style={{ touchAction: "pan-x" }}
          className="flex max-w-full items-center gap-0.5 overflow-x-auto rounded-2xl border border-[var(--av2-border)] bg-[var(--av2-surface)] p-1 shadow-lg [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {tool("select", "Select", <SelectIcon />, "V")}
          {!isPhone && tool("hand", "Hand", <HandIcon />, "H")}
          {!isPhone && <Divider />}
          <button
            type="button"
            aria-label="Marker"
            aria-pressed={penOpen}
            title="Marker (M)"
            onClick={() => onSetToolMode(penOpen ? "select" : "draw")}
            className={buttonClass(penOpen)}
          >
            <DrawIcon />
          </button>
          {creator("note", "Sticky note", <NoteIcon />, "S")}
          {creator("shape", "Shape", <ShapeIcon kind={shapeKind} />, "R")}
          {creator("text", "Text", <TextIcon />, "T")}
          {tool("arrow", "Arrow", <ArrowIcon />, "L")}
          {isPhone ? (
            <button
              type="button"
              aria-label="More items"
              aria-expanded={moreOpen}
              onClick={() => onSetMoreOpen?.(!moreOpen)}
              className={buttonClass(moreOpen)}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
                <path
                  d="M10 4v12M4 10h12"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          ) : (
            <>
              <Divider />
              {creator("image", "Image", <ImageIcon />)}
              {creator("color", "Color", <ColorIcon />)}
              {creator("todo", "Checklist", <TodoIcon />)}
              {creator("link", "Link", <LinkIcon />)}
              {creator("file", "File", <FileIcon />)}
              {creator("video", "Video", <VideoIcon />)}
            </>
          )}
        </div>
      </div>

      {ghost && (
        <div
          aria-hidden
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 opacity-80"
          style={{ left: ghost.x, top: ghost.y }}
        >
          <DragGhost kind={ghost.kind} shapeKind={shapeKind} />
        </div>
      )}
    </>
  );
}
