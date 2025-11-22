// -----------------------------------------------------------------------------
// @file: components/navigation/customer-nav.tsx
// @purpose: Top navigation for customer-facing pages (tokens, board, tickets)
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

const customerNavItems: NavItem[] = [
  { href: "/customer/tokens", label: "Tokens" },
  { href: "/customer/board", label: "Board" },
  { href: "/customer/tickets", label: "Tickets" },
];

export function CustomerNav() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/customer") return pathname === "/customer";
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <header className="mb-4 flex items-center justify-between">
      {/* Left: logo */}
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f15b2b] text-sm font-semibold text-white">
          B
        </div>
        <span className="text-lg font-semibold tracking-tight">
          Brandbite
        </span>
      </div>

      {/* Right: nav */}
      <nav className="hidden items-center gap-6 text-sm text-[#7a7a7a] md:flex">
        {customerNavItems.map((item) => {
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
