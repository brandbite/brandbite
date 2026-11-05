"use client";

import React from "react";
import { DRAW_COLORS, DRAW_SIZES } from "@/lib/moodboard";

export type ToolMode = "select" | "arrow" | "draw" | "eraser";

type BoardToolbarProps = {
  onAddNote: () => void;
  onAddImage: () => void;
  onAddColor: () => void;
  onAddLink: () => void;
  onAddFile: () => void;
  onAddTodo: () => void;
  onAddEmbed: () => void;
  toolMode: ToolMode;
  onSetToolMode: (mode: ToolMode) => void;
  drawColor: string;
  drawSize: number;
  onSetDrawColor: (color: string) => void;
  onSetDrawSize: (size: number) => void;
};

type ToolItem = {
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
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

const TOOL_BUTTON =
  "flex min-h-14 min-w-16 flex-col items-center justify-center gap-1 rounded-xl px-3 py-1.5 text-xs font-medium focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none";

function toolClass(active: boolean) {
  return `${TOOL_BUTTON} ${
    active
      ? "bg-[var(--av2-selected)] text-[var(--av2-link)]"
      : "text-[var(--av2-text)] hover:bg-[var(--av2-bg)]"
  }`;
}

function Divider() {
  return <div aria-hidden className="mx-1 h-10 w-px shrink-0 self-center bg-[var(--av2-border)]" />;
}

export function BoardToolbar({
  onAddNote,
  onAddImage,
  onAddColor,
  onAddLink,
  onAddFile,
  onAddTodo,
  onAddEmbed,
  toolMode,
  onSetToolMode,
  drawColor,
  drawSize,
  onSetDrawColor,
  onSetDrawSize,
}: BoardToolbarProps) {
  const content: ToolItem[] = [
    { label: "Note", onClick: onAddNote, icon: <NoteIcon /> },
    { label: "Image", onClick: onAddImage, icon: <ImageIcon /> },
    { label: "Color", onClick: onAddColor, icon: <ColorIcon /> },
    { label: "Link", onClick: onAddLink, icon: <LinkIcon /> },
    { label: "File", onClick: onAddFile, icon: <FileIcon /> },
  ];
  const lists: ToolItem[] = [
    { label: "Checklist", onClick: onAddTodo, icon: <TodoIcon /> },
    { label: "Video", onClick: onAddEmbed, icon: <VideoIcon /> },
  ];

  const toggle = (mode: ToolMode) => onSetToolMode(toolMode === mode ? "select" : mode);
  const add = (tool: ToolItem) => (
    <button key={tool.label} type="button" onClick={tool.onClick} className={toolClass(false)}>
      {tool.icon}
      {tool.label}
    </button>
  );

  return (
    <div className="relative rounded-2xl border border-[var(--av2-border)] bg-[var(--av2-surface)]">
      <div
        role="toolbar"
        aria-label="Moodboard tools"
        className="relative flex items-stretch gap-1 overflow-x-auto p-2 [scrollbar-width:none]"
      >
        <button
          type="button"
          aria-pressed={toolMode === "select"}
          onClick={() => onSetToolMode("select")}
          className={toolClass(toolMode === "select")}
          title="Select (V)"
        >
          <SelectIcon />
          Select
        </button>
        <Divider />
        {content.map(add)}
        <Divider />
        {lists.map(add)}
        <Divider />
        <button
          type="button"
          aria-pressed={toolMode === "arrow"}
          onClick={() => toggle("arrow")}
          className={toolClass(toolMode === "arrow")}
          title="Arrow (L)"
        >
          <ArrowIcon />
          Arrow
        </button>
        <button
          type="button"
          aria-pressed={toolMode === "draw"}
          onClick={() => toggle("draw")}
          className={toolClass(toolMode === "draw")}
          title="Draw (M)"
        >
          <DrawIcon />
          Draw
        </button>
        <button
          type="button"
          aria-pressed={toolMode === "eraser"}
          onClick={() => toggle("eraser")}
          className={toolClass(toolMode === "eraser")}
          title="Eraser (E)"
        >
          <EraserIcon />
          Eraser
        </button>
      </div>

      {toolMode === "draw" && (
        // Floats over the canvas: pushing it down would make every card jump.
        <div className="absolute top-full left-2 z-30 mt-3 flex max-w-[calc(100%-1rem)] flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-[var(--av2-border)] bg-[var(--av2-surface)] p-1 shadow-sm">
          <div role="group" aria-label="Pen color" className="flex items-center gap-1">
            {DRAW_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={drawColor === c}
                aria-label={`Color ${c}`}
                onClick={() => onSetDrawColor(c)}
                className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-[var(--av2-bg)] focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none"
              >
                <span
                  className={`h-6 w-6 rounded-full border-2 ${
                    drawColor === c ? "border-[var(--av2-accent)]" : "border-[var(--av2-border)]"
                  }`}
                  style={{ backgroundColor: c }}
                />
              </button>
            ))}
          </div>
          <div role="group" aria-label="Pen size" className="flex items-center gap-1">
            {DRAW_SIZES.map((size) => (
              <button
                key={size}
                type="button"
                aria-pressed={drawSize === size}
                aria-label={`${size} pixel stroke`}
                onClick={() => onSetDrawSize(size)}
                className={`flex h-10 w-10 items-center justify-center rounded-lg focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none ${
                  drawSize === size ? "bg-[var(--av2-selected)]" : "hover:bg-[var(--av2-bg)]"
                }`}
              >
                <span
                  className="rounded-full"
                  style={{ width: size + 2, height: size + 2, backgroundColor: drawColor }}
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
