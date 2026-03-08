"use client";

import React, { useState } from "react";

type BoardToolbarProps = {
  onAddNote: () => void;
  onAddImage: () => void;
  onAddColor: () => void;
  onAddLink: () => void;
  onAddFile: () => void;
  onAddTodo: () => void;
};

type ToolItem = {
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
};

function NoteIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect
        x="3"
        y="2"
        width="14"
        height="16"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
      />
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
      <rect
        x="2"
        y="3"
        width="16"
        height="14"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
      />
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
      <circle
        cx="10"
        cy="10"
        r="7.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="10" cy="6" r="1.5" fill="currentColor" />
      <circle cx="6.5" cy="11.5" r="1.5" fill="currentColor" />
      <circle cx="13.5" cy="11.5" r="1.5" fill="currentColor" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path
        d="M8.5 11.5L11.5 8.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
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
      <rect
        x="3"
        y="4"
        width="4"
        height="4"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect
        x="3"
        y="12"
        width="4"
        height="4"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.5"
      />
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

export function BoardToolbar({
  onAddNote,
  onAddImage,
  onAddColor,
  onAddLink,
  onAddFile,
  onAddTodo,
}: BoardToolbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const tools: ToolItem[] = [
    { label: "Note", onClick: onAddNote, icon: <NoteIcon /> },
    { label: "Image", onClick: onAddImage, icon: <ImageIcon /> },
    { label: "Color", onClick: onAddColor, icon: <ColorIcon /> },
    { label: "Link", onClick: onAddLink, icon: <LinkIcon /> },
    { label: "File", onClick: onAddFile, icon: <FileIcon /> },
    { label: "Todo", onClick: onAddTodo, icon: <TodoIcon /> },
  ];

  function handleToolClick(tool: ToolItem) {
    tool.onClick();
    setMobileOpen(false);
  }

  return (
    <>
      {/* Desktop vertical sidebar */}
      <div className="hidden w-14 flex-shrink-0 flex-col border-r border-[var(--bb-border)] bg-white py-3 md:flex">
        {tools.map((tool) => (
          <button
            key={tool.label}
            type="button"
            onClick={() => handleToolClick(tool)}
            className="flex w-full flex-col items-center gap-1 rounded-lg px-1 py-3 text-[10px] text-[var(--bb-text-secondary)] transition-colors hover:bg-[var(--bb-bg-warm)] hover:text-[var(--bb-primary)]"
          >
            {tool.icon}
            {tool.label}
          </button>
        ))}
      </div>

      {/* Mobile floating action button */}
      <div className="fixed bottom-6 right-6 z-40 md:hidden">
        {/* Expanded menu */}
        {mobileOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-30"
              onClick={() => setMobileOpen(false)}
            />
            <div className="absolute bottom-16 right-0 z-40 flex flex-col gap-2 rounded-2xl border border-[var(--bb-border)] bg-white p-2 shadow-xl">
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
