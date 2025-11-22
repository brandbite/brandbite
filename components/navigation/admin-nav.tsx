// -----------------------------------------------------------------------------
// @file: components/navigation/admin-nav.tsx
// @purpose: Top navigation for admin-facing pages (board, tickets, ledger, withdrawals)
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

const adminNavItems: NavItem[] = [
  { href: "/admin/companies", label: "Companies" },
  { href: "/admin/board", label: "Board" },
  { href: "/admin/tickets", label: "Tickets" },
  { href: "/admin/ledger", label: "Ledger" },
  { href: "/admin/withdrawals", label: "Withdrawals" },
];

export function AdminNav() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin";
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <header className="mb-6 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f15b2b] text-sm font-semibold text-white">
          B
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b1afa9]">
            Admin
          </p>
          <h1 className="text-lg font-semibold tracking-tight">
            Brandbite
          </h1>
        </div>
      </div>

      <nav className="hidden items-center gap-6 text-sm text-[#7a7a7a] md:flex">
        {adminNavItems.map((item) => {
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
