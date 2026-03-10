"use client";

import React, { useState, useRef, useEffect } from "react";
import { DRAW_COLORS, DRAW_SIZES } from "@/lib/moodboard";

export type ToolMode = "select" | "arrow" | "draw";

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

function VideoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="2" y="4" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 8V12L12 10L8 8Z" fill="currentColor" />
    </svg>
  );
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [drawSettingsOpen, setDrawSettingsOpen] = useState(false);
  const drawSettingsRef = useRef<HTMLDivElement>(null);

  // Close draw settings on outside click
  useEffect(() => {
    if (!drawSettingsOpen) return;
    function handleClick(e: MouseEvent) {
      if (drawSettingsRef.current && !drawSettingsRef.current.contains(e.target as Node)) {
        setDrawSettingsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [drawSettingsOpen]);

  const tools: ToolItem[] = [
    { label: "Note", onClick: onAddNote, icon: <NoteIcon /> },
    { label: "Image", onClick: onAddImage, icon: <ImageIcon /> },
    { label: "Color", onClick: onAddColor, icon: <ColorIcon /> },
    { label: "Link", onClick: onAddLink, icon: <LinkIcon /> },
    { label: "File", onClick: onAddFile, icon: <FileIcon /> },
    { label: "Todo", onClick: onAddTodo, icon: <TodoIcon /> },
    { label: "Video", onClick: onAddEmbed, icon: <VideoIcon /> },
  ];

  const arrowActive = toolMode === "arrow";
  const drawActive = toolMode === "draw";

  function handleToolClick(tool: ToolItem) {
    tool.onClick();
    setMobileOpen(false);
  }

  return (
    <>
      {/* Desktop vertical sidebar */}
      <div className="hidden w-14 flex-shrink-0 flex-col gap-0.5 border-r border-[var(--bb-border-subtle)] bg-white/80 py-4 backdrop-blur-sm md:flex">
        {tools.map((tool) => (
          <button
            key={tool.label}
            type="button"
            onClick={() => handleToolClick(tool)}
            className="flex w-full flex-col items-center gap-1 rounded-xl px-1 py-2.5 text-[10px] font-medium text-[var(--bb-text-tertiary)] transition-all duration-150 hover:bg-[var(--bb-bg-warm)] hover:text-[var(--bb-secondary)] active:scale-95"
          >
            {tool.icon}
            {tool.label}
          </button>
        ))}

        {/* Divider */}
        <div className="mx-3 my-1.5 border-t border-[var(--bb-border-subtle)]" />

        {/* Arrow toggle */}
        <button
          type="button"
          onClick={() => onSetToolMode(arrowActive ? "select" : "arrow")}
          className={`flex w-full flex-col items-center gap-1 rounded-xl px-1 py-2.5 text-[10px] font-medium transition-all duration-150 active:scale-95 ${
            arrowActive
              ? "border-l-2 border-l-[var(--bb-primary)] text-[var(--bb-primary)]"
              : "text-[var(--bb-text-tertiary)] hover:bg-[var(--bb-bg-warm)] hover:text-[var(--bb-secondary)]"
          }`}
        >
          <ArrowIcon />
          Arrow
        </button>

        {/* Draw toggle + settings */}
        <div ref={drawSettingsRef} className="relative">
          <button
            type="button"
            onClick={() => {
              if (drawActive) {
                onSetToolMode("select");
              } else {
                onSetToolMode("draw");
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              setDrawSettingsOpen((prev) => !prev);
            }}
            className={`flex w-full flex-col items-center gap-1 rounded-xl px-1 py-2.5 text-[10px] font-medium transition-all duration-150 active:scale-95 ${
              drawActive
                ? "border-l-2 border-l-[var(--bb-primary)] text-[var(--bb-primary)]"
                : "text-[var(--bb-text-tertiary)] hover:bg-[var(--bb-bg-warm)] hover:text-[var(--bb-secondary)]"
            }`}
          >
            <DrawIcon />
            Draw
          </button>

          {/* Draw color indicator dot */}
          {drawActive && (
            <button
              type="button"
              onClick={() => setDrawSettingsOpen((prev) => !prev)}
              className="mx-auto mt-0.5 flex items-center justify-center"
              aria-label="Drawing settings"
            >
              <div
                className="h-3 w-3 rounded-full border border-gray-300"
                style={{ backgroundColor: drawColor }}
              />
            </button>
          )}

          {/* Draw settings popover */}
          {drawSettingsOpen && (
            <div className="absolute top-0 left-14 z-50 w-44 rounded-xl border border-[var(--bb-border-subtle)] bg-white/95 p-3 shadow-[0_4px_16px_rgba(0,0,0,0.1),0_1px_4px_rgba(0,0,0,0.06)] backdrop-blur-md">
              <p className="mb-2 text-[10px] font-semibold tracking-wider text-[var(--bb-text-secondary)] uppercase">
                Color
              </p>
              <div className="mb-3 flex flex-wrap gap-1.5">
                {DRAW_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => onSetDrawColor(c)}
                    className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 ${
                      drawColor === c
                        ? "scale-110 border-[var(--bb-primary)]"
                        : "border-transparent"
                    }`}
                    style={{ backgroundColor: c }}
                    aria-label={`Color ${c}`}
                  />
                ))}
              </div>

              <p className="mb-2 text-[10px] font-semibold tracking-wider text-[var(--bb-text-secondary)] uppercase">
                Size
              </p>
              <div className="flex items-center gap-2">
                {DRAW_SIZES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => onSetDrawSize(s)}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${
                      drawSize === s
                        ? "border-[var(--bb-primary)] bg-[var(--bb-primary)]/10"
                        : "border-[var(--bb-border)] hover:bg-[var(--bb-bg-warm)]"
                    }`}
                    aria-label={`${s}px stroke`}
                  >
                    <div
                      className="rounded-full"
                      style={{
                        width: s + 2,
                        height: s + 2,
                        backgroundColor: drawColor,
                      }}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile floating action button */}
      <div className="fixed right-6 bottom-6 z-40 md:hidden">
        {/* Expanded menu */}
        {mobileOpen && (
          <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-30" onClick={() => setMobileOpen(false)} />
            <div className="absolute right-0 bottom-16 z-40 flex flex-col gap-1 rounded-2xl border border-[var(--bb-border-subtle)] bg-white/95 p-2 shadow-[0_8px_32px_rgba(0,0,0,0.12)] backdrop-blur-md">
              {tools.map((tool) => (
                <button
                  key={tool.label}
                  type="button"
                  onClick={() => handleToolClick(tool)}
                  className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm text-[var(--bb-secondary)] transition-colors hover:bg-[var(--bb-bg-warm)] hover:text-[var(--bb-primary)]"
                >
                  {tool.icon}
                  {tool.label}
                </button>
              ))}
            </div>
          </>
        )}

        {/* FAB toggle button */}
        <button
          type="button"
          onClick={() => setMobileOpen((prev) => !prev)}
          className="relative z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--bb-primary)] text-white shadow-lg transition-transform hover:bg-[var(--bb-primary-hover)] active:scale-95"
          aria-label="Add item"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            className={`transition-transform ${mobileOpen ? "rotate-45" : ""}`}
          >
            <path
              d="M12 5V19M5 12H19"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </>
  );
}
