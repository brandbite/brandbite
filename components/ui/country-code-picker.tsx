// -----------------------------------------------------------------------------
// @file: components/ui/country-code-picker.tsx
// @purpose: Searchable country-code picker for phone-number inputs. Replaces
//           the native <select> on the talent application form's WhatsApp
//           field with a popover-style picker that supports flag icons,
//           free-text search by name OR dial code, and click-outside /
//           Escape close.
//
//           Strictly UX, not pixel-perfect design — the trigger uses the
//           project's existing input border tokens so it visually fits in
//           the same row as the FormInput it's paired with.
//
//           Keyboard:
//             - Enter / Space on trigger → toggle popover
//             - Escape inside popover    → close + return focus to trigger
//             - Search input is auto-focused on open
//
//           Accessibility:
//             - Trigger is a <button> with aria-haspopup="listbox" +
//               aria-expanded
//             - Popover root has role="dialog" so screen readers announce
//               the search context
//             - Country list uses role="listbox" + role="option" with
//               aria-selected on the current pick
//
//           NOT a generic Combobox — limited to country picking. If the
//           pattern proves useful elsewhere we'll lift it into a
//           reusable Combobox.
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { COUNTRIES, findCountryByIso, isoToFlag, type CountryRow } from "@/lib/countries";

type Props = {
  /** ISO 3166-1 alpha-2 of the currently selected country, or "" for none. */
  value: string;
  /** Called with the new ISO when the user picks a country. */
  onChange: (iso: string) => void;
  /** Forwarded to the trigger button so a parent <label htmlFor> can target it. */
  id?: string;
  /** Surfaced via aria-label on the trigger button so screen readers know
   *  what the unlabeled flag-only trigger is for. */
  ariaLabel?: string;
  /** Reflected on the trigger so a parent fieldset / form can disable us. */
  disabled?: boolean;
};

export function CountryCodePicker({ value, onChange, id, ariaLabel, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const selected = findCountryByIso(value);

  // Filter on every keystroke. Match against name or dial code (with or
  // without the leading "+"). Case-insensitive. ~250 entries means a
  // straight Array.filter on every keystroke is cheaper than memoization.
  const filtered = useMemo<CountryRow[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    const stripped = q.replace(/^\+/, "");
    return COUNTRIES.filter((c) => {
      if (c.name.toLowerCase().includes(q)) return true;
      if (c.dialCode.toLowerCase().includes(q)) return true;
      if (stripped && c.dialCode.replace(/^\+/, "").includes(stripped)) return true;
      if (c.iso2.toLowerCase() === q) return true;
      return false;
    });
  }, [query]);

  // Centralized "close + reset" so every close path stays in sync. Prefer
  // this over a useEffect that reacts to `open === false` — that pattern
  // triggers the `react-hooks/set-state-in-effect` warning because each
  // close would cause an extra render to set query="". Declared above the
  // effects that reference it so the linter's "access before declared"
  // check is happy.
  function closePopover() {
    setOpen(false);
    setQuery("");
  }

  // Auto-focus the search input on open. The microtask defer prevents
  // the focus call from losing to the click event that opened the
  // popover (which momentarily re-focuses the trigger).
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  // Click-outside to close. Only attach the listener while open so we
  // aren't paying for a global listener on every render.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node | null;
      if (!target) return;
      if (popoverRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      closePopover();
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape" && open) {
      e.preventDefault();
      closePopover();
      triggerRef.current?.focus();
    }
  }

  function handleSelect(iso: string) {
    onChange(iso);
    closePopover();
    // Return focus to the trigger so keyboard users don't lose their place.
    triggerRef.current?.focus();
  }

  // Display label for the trigger — flag + chevron only, by design. The
  // dial code lives in the inline prefix outside the trigger so the
  // trigger stays narrow.
  const flag = selected ? isoToFlag(selected.iso2) : "🌐";

  return (
    <div className="relative inline-block" onKeyDown={handleKeyDown}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel ?? "Select country code"}
        className="flex h-10 items-center gap-1.5 rounded-l-xl border border-r-0 border-[var(--bb-border)] bg-white px-3 text-sm text-[var(--bb-secondary)] transition-colors hover:bg-[var(--bb-bg-warm)] disabled:opacity-50"
      >
        <span aria-hidden className="text-base leading-none">
          {flag}
        </span>
        <svg
          aria-hidden
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={open ? "rotate-180 transition-transform" : "transition-transform"}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label="Country picker"
          className="absolute top-full left-0 z-50 mt-1 w-72 rounded-xl border border-[var(--bb-border)] bg-white shadow-lg"
        >
          <div className="border-b border-[var(--bb-border)] p-2">
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for countries"
              aria-label="Search countries"
              className="w-full rounded-lg border border-[var(--bb-border-subtle)] bg-[var(--bb-bg-warm)] px-3 py-2 text-sm text-[var(--bb-secondary)] outline-none focus:border-[var(--bb-primary)]"
            />
          </div>
          <ul role="listbox" className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-[var(--bb-text-muted)]">No countries match.</li>
            ) : (
              filtered.map((c) => {
                const isSelected = c.iso2 === value;
                return (
                  <li
                    key={c.iso2}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(c.iso2)}
                    className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--bb-bg-warm)] ${
                      isSelected ? "bg-[var(--bb-bg-warm)]" : ""
                    }`}
                  >
                    <span aria-hidden className="text-base leading-none">
                      {isoToFlag(c.iso2)}
                    </span>
                    <span className="flex-1 truncate text-[var(--bb-secondary)]">
                      {c.name} ({c.dialCode})
                    </span>
                    {isSelected && (
                      <svg
                        aria-hidden
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-[var(--bb-primary)]"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
