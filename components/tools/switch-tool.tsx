// -----------------------------------------------------------------------------
// @file: components/tools/switch-tool.tsx
// @purpose: "Switch tool": a menu at the top of a free tool's page that jumps
//           to any other free tool, in the three groups the footer uses.
// -----------------------------------------------------------------------------

"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import { TOOL_ICONS } from "@/components/tools/tool-icons";
import { PUBLIC_TOOL_GROUPS, PUBLIC_TOOL_TONES } from "@/lib/tools/public-tools";

export function SwitchTool({ current }: { current: string }) {
  const menuId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen(!open)}
        className="flex h-11 items-center gap-3 rounded-[10px] border border-[var(--cs-border)] bg-[var(--cs-surface)] px-4 text-sm leading-5 font-semibold transition-colors hover:border-[var(--cs-text)] focus-visible:ring-2 focus-visible:ring-[var(--cs-text)] focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        Switch tool
        <svg
          aria-hidden
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <nav
        id={menuId}
        aria-label="Free tools"
        hidden={!open}
        className="absolute top-[52px] right-0 z-30 max-h-[70vh] w-[300px] overflow-y-auto rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-3 shadow-[0_16px_40px_rgba(36,37,40,0.14)] max-[767px]:w-[min(300px,calc(100vw-32px))]"
      >
        {PUBLIC_TOOL_GROUPS.map((group) => {
          const tone = PUBLIC_TOOL_TONES[group.tone];
          return (
            <div key={group.id} className="pb-2 last:pb-0">
              <p className="px-2 pt-2 pb-1 text-xs leading-4 font-semibold tracking-wide text-[var(--cs-muted)] uppercase">
                {group.title}
              </p>
              <ul>
                {group.tools.map((item) => {
                  const Icon = TOOL_ICONS[item.icon];
                  const isCurrent = item.id === current;
                  return (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        aria-current={isCurrent ? "page" : undefined}
                        onClick={() => setOpen(false)}
                        className={`flex min-h-11 items-center gap-3 rounded-[10px] px-2 text-sm leading-5 font-medium focus-visible:ring-2 focus-visible:ring-[var(--cs-text)] focus-visible:outline-none ${
                          isCurrent ? "bg-[var(--cs-soft)]" : "hover:bg-[var(--cs-background)]"
                        }`}
                      >
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone.tile} ${tone.glyph}`}
                        >
                          <Icon width={16} height={16} />
                        </span>
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
        <Link
          href="/tools"
          onClick={() => setOpen(false)}
          className="mt-1 flex min-h-11 items-center justify-between rounded-[10px] border-t border-[var(--cs-border)] px-2 pt-1 text-sm leading-5 font-semibold text-[var(--cs-brand-strong)] hover:underline"
        >
          Explore all tools
          <span aria-hidden>→</span>
        </Link>
      </nav>
    </div>
  );
}
