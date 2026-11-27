// -----------------------------------------------------------------------------
// @file: components/marketing/footer-tools.tsx
// @purpose: "Find your next creative shortcut": every free tool in three
//           groups, above the footer columns on every marketing page. It
//           replaces the footer's long "Free tools" column; the links stay in
//           the page's HTML on every screen, which is what search engines use.
//           On phones each group opens and closes so the list stays short.
// -----------------------------------------------------------------------------

"use client";

import Link from "next/link";
import { useState } from "react";

import { TOOL_ICONS } from "@/components/tools/tool-icons";
import { PUBLIC_TOOL_GROUPS, PUBLIC_TOOL_TONES } from "@/lib/tools/public-tools";

export function FooterTools() {
  // Phones only: which groups are open. Wider screens always show every list.
  const [open, setOpen] = useState<Record<string, boolean>>({});

  return (
    <section
      aria-labelledby="footer-tools-heading"
      className="flex w-full flex-col px-14 pt-14 max-[1179px]:px-8 max-[767px]:px-5 max-[767px]:pt-10"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
        <h2
          id="footer-tools-heading"
          className="font-[family-name:var(--font-jakarta)] text-[32px] leading-10 font-extrabold text-[#2B2D33] max-[767px]:text-2xl max-[767px]:leading-8"
        >
          Find your next creative shortcut.
        </h2>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-[#E3F1E4] px-3 py-1 text-sm leading-5 font-semibold text-[#1F6B3A]">
            Free tools
          </span>
          <Link
            href="/tools"
            className="inline-flex h-11 items-center gap-2 rounded-full border border-[#FF6426] px-5 text-sm leading-5 font-bold text-[#C2410C] transition-colors hover:bg-[#FFF1EA]"
          >
            Explore all tools
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-3 gap-x-10 max-[767px]:mt-6 max-[767px]:grid-cols-1">
        {PUBLIC_TOOL_GROUPS.map((group, index) => {
          const tone = PUBLIC_TOOL_TONES[group.tone];
          const isOpen = Boolean(open[group.id]);
          const listId = `footer-tools-${group.id}`;
          return (
            <nav
              key={group.id}
              aria-label={group.title}
              className={`max-[767px]:border-t max-[767px]:border-[#D7D8DD] ${
                index > 0
                  ? "min-[768px]:border-l min-[768px]:border-[#E3E0DC] min-[768px]:pl-10"
                  : ""
              } ${index === PUBLIC_TOOL_GROUPS.length - 1 ? "max-[767px]:border-b" : ""}`}
            >
              <h3 className="text-lg leading-7 font-bold text-[#2B2D33]">
                {/* A plain heading on wider screens; a switch for the list on phones. */}
                <span className="max-[767px]:hidden">{group.title}</span>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={listId}
                  onClick={() => setOpen((current) => ({ ...current, [group.id]: !isOpen }))}
                  className="hidden min-h-14 w-full items-center justify-between gap-3 text-left max-[767px]:flex"
                >
                  {group.title}
                  <svg
                    aria-hidden="true"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
              </h3>
              <ul
                id={listId}
                className={`mt-4 flex flex-col gap-2 max-[767px]:mt-0 max-[767px]:pb-4 ${
                  isOpen ? "" : "max-[767px]:hidden"
                }`}
              >
                {group.tools.map((item) => {
                  const Icon = TOOL_ICONS[item.icon];
                  return (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        className="group flex min-h-11 items-center gap-4 text-base leading-6 font-medium text-[#2B2D33] transition-colors hover:text-[#C2410C]"
                      >
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tone.tile} ${tone.glyph}`}
                        >
                          <Icon width={18} height={18} />
                        </span>
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          );
        })}
      </div>
    </section>
  );
}
