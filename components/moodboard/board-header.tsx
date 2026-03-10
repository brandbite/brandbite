"use client";

import React, { useState, useRef, useEffect } from "react";

type BoardHeaderProps = {
  title: string;
  onTitleChange: (title: string) => void;
  projectName?: string;
  onBack: () => void;
  onDelete: () => void;
};

export function BoardHeader({
  title,
  onTitleChange,
  projectName,
  onBack,
  onDelete,
}: BoardHeaderProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) {
      setEditValue(title);
    }
  }, [title, editing]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function saveTitle() {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== title) {
      onTitleChange(trimmed);
    }
    setEditing(false);
  }

  return (
    <div className="flex items-center justify-between border-b border-[var(--bb-border-subtle)] bg-white/80 px-6 py-3 backdrop-blur-md">
      {/* Left: back + breadcrumbs */}
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-[var(--bb-text-secondary)] transition-colors hover:bg-[var(--bb-bg-warm)] hover:text-[var(--bb-secondary)]"
          aria-label="Go back"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path
              d="M11.25 4.5L6.75 9L11.25 13.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <nav className="hidden items-center gap-1.5 text-sm sm:flex">
          <span className="text-[var(--bb-text-secondary)]">Moodboards</span>
          {projectName && (
            <>
              <span className="text-[var(--bb-text-muted)]">/</span>
              <span className="text-[var(--bb-text-secondary)]">{projectName}</span>
            </>
          )}
          <span className="text-[var(--bb-text-muted)]">/</span>
        </nav>
      </div>

      {/* Center: editable title */}
      <div className="min-w-0 flex-1 px-4 text-center">
        {editing ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveTitle();
              if (e.key === "Escape") setEditing(false);
            }}
            className="mx-auto w-full max-w-md rounded-lg border border-[var(--bb-primary)] bg-white px-3 py-1.5 text-center text-sm font-semibold text-[var(--bb-secondary)] outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-block max-w-md truncate rounded-lg px-3 py-1.5 text-sm font-semibold text-[var(--bb-secondary)] transition-colors hover:bg-[var(--bb-bg-warm)]"
            title="Click to edit title"
          >
            {title}
          </button>
        )}
      </div>

      {/* Right: delete */}
      <div className="flex-shrink-0">
        <button
          type="button"
          onClick={onDelete}
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-red-500 transition-colors hover:bg-red-50"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M3 4.5H13M5.5 4.5V3.5C5.5 2.94772 5.94772 2.5 6.5 2.5H9.5C10.0523 2.5 10.5 2.94772 10.5 3.5V4.5M6.5 7.5V11.5M9.5 7.5V11.5M4 4.5L4.5 13C4.5 13.5523 4.94772 14 5.5 14H10.5C11.0523 14 11.5 13.5523 11.5 13L12 4.5"
              stroke="currentColor"
              strokeWidth="1.25"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="hidden sm:inline">Delete</span>
        </button>
      </div>
    </div>
  );
}
