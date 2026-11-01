// -----------------------------------------------------------------------------
// @file: components/admin/v2/command-palette.tsx
// @purpose: "Search workspace" (⌘K / Ctrl+K) — a jump-to-page palette over
//           every admin route. Client-only, no backend search: it filters
//           the admin page index by label and section.
// -----------------------------------------------------------------------------

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { PageEntry } from "./admin-nav";
import { useConfirmDiscard } from "./unsaved-changes";

export function CommandPalette({
  open,
  onClose,
  pages,
}: {
  open: boolean;
  onClose: () => void;
  pages: PageEntry[];
}) {
  const router = useRouter();
  const confirmDiscard = useConfirmDiscard();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pages;
    return pages.filter(
      (p) => p.label.toLowerCase().includes(q) || p.section.toLowerCase().includes(q),
    );
  }, [pages, query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    // Focus after the dialog paints.
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  useEffect(() => setActive(0), [query]);

  if (!open) return null;

  const go = async (p: PageEntry | undefined) => {
    if (!p) return;
    onClose();
    if (!(await confirmDiscard())) return;
    router.push(p.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(results[active]);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh]">
      <button
        type="button"
        aria-label="Close search"
        className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search workspace"
        className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-[var(--av2-border)] bg-[var(--av2-surface)] shadow-xl"
        onKeyDown={onKeyDown}
      >
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={results[active] ? `${listId}-${active}` : undefined}
          placeholder="Search pages…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-14 w-full border-b border-[var(--av2-border)] bg-transparent px-5 text-base text-[var(--av2-text)] placeholder:text-[var(--av2-text-2)] focus:outline-none"
        />
        <ul id={listId} role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
          {results.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-[var(--av2-text-2)]">
              No pages match “{query}”.
            </li>
          )}
          {results.map((p, i) => (
            <li
              key={p.href}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                go(p);
              }}
              className={[
                "flex cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 text-sm",
                i === active ? "bg-[var(--av2-selected)] text-[var(--av2-link)]" : "",
              ].join(" ")}
            >
              <span className="font-medium">{p.label}</span>
              <span className="text-xs text-[var(--av2-text-2)]">{p.section}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
