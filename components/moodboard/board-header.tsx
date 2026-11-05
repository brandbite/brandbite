"use client";

import React, { useEffect, useRef, useState } from "react";

type BoardHeaderProps = {
  title: string;
  itemCount: number;
  onTitleChange: (title: string) => void;
  onBack: () => void;
  onDelete: () => void;
};

const CONTROL =
  "flex h-11 shrink-0 items-center gap-2 rounded-xl border border-[var(--av2-border)] bg-[var(--av2-surface)] px-4 text-sm font-medium shadow-sm text-[var(--av2-text)] hover:bg-[var(--av2-bg)] focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none";

export function BoardHeader({
  title,
  itemCount,
  onTitleChange,
  onBack,
  onDelete,
}: BoardHeaderProps) {
  const [value, setValue] = useState(title);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => setValue(title), [title]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  function saveTitle() {
    const trimmed = value.trim();
    if (trimmed && trimmed !== title) onTitleChange(trimmed);
    else setValue(title);
  }

  return (
    <div className="pointer-events-none absolute inset-x-3 top-3 z-30 flex items-center gap-2 [&>*]:pointer-events-auto">
      <button type="button" onClick={onBack} className={CONTROL}>
        <span aria-hidden>←</span>
        <span className="hidden sm:inline">Back to moodboards</span>
        <span className="sr-only sm:hidden">Back to moodboards</span>
      </button>

      <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-[var(--av2-border)] bg-[var(--av2-surface)] px-4 shadow-sm focus-within:border-[var(--av2-accent)] md:w-64 md:flex-none">
        <span className="sr-only">Moodboard title</span>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              setValue(title);
              // Skips the save in onBlur, since the value is back to the title.
              requestAnimationFrame(() => (document.activeElement as HTMLElement)?.blur());
            }
          }}
          className="w-full min-w-0 bg-transparent text-base font-semibold text-[var(--av2-text)] outline-none"
        />
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden
          className="shrink-0"
        >
          <path
            d="M11 2.5l2.5 2.5L6 12.5l-3 .5.5-3L11 2.5z"
            stroke="var(--av2-text-2)"
            strokeWidth="1.25"
            strokeLinejoin="round"
          />
        </svg>
      </label>

      <span className="hidden rounded-full border border-[var(--av2-border)] bg-[var(--av2-surface)] px-3 py-1 text-sm whitespace-nowrap text-[var(--av2-text-2)] tabular-nums sm:inline">
        {itemCount} {itemCount === 1 ? "item" : "items"}
      </span>

      <div ref={menuRef} className="relative md:ml-auto">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
          className={CONTROL}
        >
          <span aria-hidden>•••</span>
          <span className="max-md:sr-only">More</span>
        </button>
        {menuOpen && (
          <div
            role="menu"
            className="absolute top-full right-0 z-40 mt-2 w-48 rounded-xl border border-[var(--av2-border)] bg-[var(--av2-surface)] p-1 shadow-lg"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onDelete();
              }}
              className="flex min-h-10 w-full items-center rounded-lg px-3 text-left text-sm font-medium text-[var(--av2-error-text)] hover:bg-[var(--av2-bg)]"
            >
              Delete moodboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
