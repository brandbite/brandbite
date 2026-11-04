// -----------------------------------------------------------------------------
// @file: components/colors/studio/action-menu.tsx
// @purpose: A button that opens a short list of actions. The list is positioned
//           against the window, so a scrolling palette list can't clip it, and it
//           closes on scroll rather than drifting away from its button.
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";

const ITEM_HEIGHT = 44;
const MENU_PADDING = 16;
const GAP = 8;

export type ActionMenuItem = {
  label: string;
  onSelect: () => void;
  danger?: boolean;
};

export function ActionMenu({
  label,
  buttonClassName,
  children,
  items,
}: {
  /** Accessible name, when the button's content doesn't provide one. */
  label?: string;
  buttonClassName: string;
  children: ReactNode;
  items: ActionMenuItem[];
}) {
  const menuId = useId();
  const [position, setPosition] = useState<CSSProperties | null>(null);
  const open = position !== null;
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = () => setPosition(null);
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    // Capture, because scrolling inside the palette list doesn't bubble.
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const toggle = () => {
    if (open || !buttonRef.current) {
      setPosition(null);
      return;
    }
    const rect = buttonRef.current.getBoundingClientRect();
    const height = items.length * ITEM_HEIGHT + MENU_PADDING;
    const fitsBelow = rect.bottom + GAP + height <= window.innerHeight;
    setPosition({
      top: fitsBelow ? rect.bottom + GAP : Math.max(GAP, rect.top - GAP - height),
      right: document.documentElement.clientWidth - rect.right,
    });
  };

  return (
    <div ref={containerRef} className="shrink-0">
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={toggle}
        className={buttonClassName}
      >
        {children}
      </button>
      <ul
        id={menuId}
        hidden={!open}
        style={position ?? undefined}
        className="fixed z-30 min-w-[180px] rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-2 shadow-lg"
      >
        {items.map((item) => (
          <li key={item.label}>
            <button
              type="button"
              onClick={() => {
                setPosition(null);
                item.onSelect();
              }}
              className={`flex h-11 w-full items-center rounded-[10px] px-3 text-left text-sm leading-5 font-medium hover:bg-[var(--cs-soft)] ${
                item.danger ? "text-[var(--cs-danger)]" : ""
              }`}
            >
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
