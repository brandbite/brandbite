// -----------------------------------------------------------------------------
// @file: components/colors/studio/tool-nav.tsx
// @purpose: Color Studio tool menu with the "More tools" disclosure and the Saved
//           shortcut. Escape closes the menu and returns focus to its button.
// -----------------------------------------------------------------------------

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import {
  STUDIO_MORE_TOOLS,
  STUDIO_NAV,
  STUDIO_SAVED_LINK,
  type StudioNavItem,
} from "@/components/marketing/color-tools";

import { BookmarkIcon, ChevronDownIcon } from "./icons";

const PILL =
  "flex h-11 items-center gap-1.5 rounded-full px-4 text-sm leading-5 font-medium whitespace-nowrap transition-colors";
const PILL_IDLE =
  "border border-[var(--cs-border)] bg-[var(--cs-surface)] text-[var(--cs-text)] hover:border-[var(--cs-text)]";
const PILL_ACTIVE = "bg-[var(--cs-text)] text-white";

/** Overview only matches exactly; a tool also owns its nested pages. */
function isActive(pathname: string, href: string, overviewHref: string): boolean {
  return href === overviewHref
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

export function ToolNav({
  items = STUDIO_NAV,
  moreTools = STUDIO_MORE_TOOLS,
  saved = STUDIO_SAVED_LINK,
  overviewHref = "/colors",
  ariaLabel,
  moreLabel = "More tools",
}: {
  items?: StudioNavItem[];
  moreTools?: StudioNavItem[];
  saved?: StudioNavItem | null;
  /** The section's overview link, which is only active on its own page. */
  overviewHref?: string;
  ariaLabel?: string;
  moreLabel?: string;
}) {
  const pathname = usePathname();
  const menuId = useId();
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const moreActive = moreTools.some((tool) => isActive(pathname, tool.href, overviewHref));

  return (
    <nav
      aria-label={ariaLabel ?? "Color Studio tools"}
      className="flex min-h-14 flex-wrap items-center gap-2"
    >
      {items.map((item) => {
        const active = isActive(pathname, item.href, overviewHref);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`${PILL} ${active ? PILL_ACTIVE : PILL_IDLE}`}
          >
            {item.label}
          </Link>
        );
      })}

      {moreTools.length > 0 ? (
        <div ref={containerRef} className="relative">
          <button
            ref={buttonRef}
            type="button"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            onClick={() => setMenuOpen((open) => !open)}
            className={`${PILL} ${moreActive ? PILL_ACTIVE : PILL_IDLE}`}
          >
            {moreLabel}
            <ChevronDownIcon />
          </button>
          <ul
            id={menuId}
            hidden={!menuOpen}
            className="absolute top-full left-0 z-20 mt-2 min-w-[200px] rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-2 shadow-lg"
          >
            {moreTools.map((tool) => (
              <li key={tool.href}>
                <Link
                  href={tool.href}
                  aria-current={isActive(pathname, tool.href, overviewHref) ? "page" : undefined}
                  onClick={() => setMenuOpen(false)}
                  className="flex h-11 items-center rounded-[10px] px-3 text-sm leading-5 font-medium whitespace-nowrap hover:bg-[var(--cs-soft)] aria-[current=page]:bg-[var(--cs-soft)]"
                >
                  {tool.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {saved ? (
        <Link
          href={saved.href}
          aria-current={isActive(pathname, saved.href, overviewHref) ? "page" : undefined}
          className={`${PILL} ${
            isActive(pathname, saved.href, overviewHref)
              ? "bg-[var(--cs-soft)] text-[var(--cs-soft-text)]"
              : PILL_IDLE
          }`}
        >
          <BookmarkIcon />
          {saved.label}
        </Link>
      ) : null}
    </nav>
  );
}
