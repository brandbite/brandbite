// -----------------------------------------------------------------------------
// @file: components/navigation/designer-nav.tsx
// @purpose: Top navigation for designer-facing pages (overview, board, tickets, withdrawals)
// @version: v0.1.0
// @status: experimental
// @lastUpdate: 2025-11-22
// -----------------------------------------------------------------------------

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";

type NavItem = {
  href: string;
  label: string;
};

const designerNavItems: NavItem[] = [
  { href: "/designer", label: "Overview" },
  { href: "/designer/board", label: "Board" },
  { href: "/designer/tickets", label: "Tickets" },
  { href: "/designer/withdrawals", label: "Withdrawals" }, // varsa; yoksa sonra ekleriz
];

export function DesignerNav() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/designer") return pathname === "/designer";
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <header className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f15b2b] text-sm font-semibold text-white">
          B
        </div>
        <span className="text-lg font-semibold tracking-tight">
          Brandbite · Designer
        </span>
      </div>

      <nav className="hidden items-center gap-6 text-sm text-[#7a7a7a] md:flex">
        {designerNavItems.map((item) => {
          const active = isActive(item.href);

          if (active) {
            return (
              <span
                key={item.href}
                aria-current="page"
                className="font-semibold text-[#424143]"
              >
                {item.label}
              </span>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className="font-medium text-[#7a7a7a] hover:text-[#424143]"
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
