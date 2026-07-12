// -----------------------------------------------------------------------------
// @file: components/marketing/home-header.tsx
// @purpose: Marketing header for the redesigned homepage + coming-soon page.
//           Desktop nav collapses into a burger menu below 768px.
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-07-12
// -----------------------------------------------------------------------------

"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

// Pages that exist in the new design go to their real routes; everything
// still being redesigned points at /coming-soon until its page ships.
const NAV_LINKS = [
  { label: "How it works?", href: "/#how-it-works" },
  { label: "Pricing", href: "/coming-soon" },
  { label: "Showcase", href: "/coming-soon" },
  { label: "FAQs", href: "/coming-soon" },
  { label: "Blog", href: "/coming-soon" },
];

export function HomeHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="flex flex-row items-center gap-[89px] px-14 pt-[37px] max-[1179px]:gap-8 max-[1179px]:px-8 max-[1179px]:pt-6 max-[767px]:flex-wrap max-[767px]:gap-4 max-[767px]:px-5 max-[767px]:pt-5">
      <Link href="/" className="flex shrink-0" aria-label="Brandbite home">
        <Image src="/home/logo.svg" alt="Brandbite" width={145} height={36} priority />
      </Link>
      <nav
        className={`flex flex-1 flex-row items-center justify-center gap-[50px] max-[1179px]:gap-7 ${
          menuOpen
            ? "max-[767px]:order-3 max-[767px]:flex max-[767px]:basis-full max-[767px]:flex-col max-[767px]:items-start max-[767px]:justify-start max-[767px]:gap-[22px] max-[767px]:border-t max-[767px]:border-[#D7D8DD] max-[767px]:px-1 max-[767px]:pt-[18px] max-[767px]:pb-3"
            : "max-[767px]:hidden"
        }`}
        onClick={() => setMenuOpen(false)}
      >
        {NAV_LINKS.map((link) => (
          <Link
            key={link.label}
            href={link.href}
            className="font-brand text-xl leading-none whitespace-nowrap text-[#1F2024] transition-colors hover:text-[#FF6426]"
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <Link
        href="/coming-soon"
        className="font-brand flex h-10 w-[141px] shrink-0 flex-row items-center justify-center gap-2.5 rounded-[10px] bg-[#1F2024] px-5 py-2.5 text-xl leading-none font-bold text-white transition-colors hover:bg-[#FF6426] max-[767px]:ml-auto max-[767px]:h-9 max-[767px]:w-auto max-[767px]:px-3.5 max-[767px]:py-2 max-[767px]:text-base"
      >
        Start Now!
      </Link>
      <button
        type="button"
        aria-label="Menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
        className="hidden h-10 w-10 shrink-0 cursor-pointer flex-col items-center justify-center gap-[5px] rounded-[10px] border-none bg-transparent p-0 max-[767px]:flex"
      >
        <span
          className={`block h-[2.5px] w-[22px] rounded-[2px] bg-[#1F2024] transition-transform ${menuOpen ? "translate-y-[7.5px] rotate-45" : ""}`}
        />
        <span
          className={`block h-[2.5px] w-[22px] rounded-[2px] bg-[#1F2024] transition-opacity ${menuOpen ? "opacity-0" : "opacity-100"}`}
        />
        <span
          className={`block h-[2.5px] w-[22px] rounded-[2px] bg-[#1F2024] transition-transform ${menuOpen ? "-translate-y-[7.5px] -rotate-45" : ""}`}
        />
      </button>
    </header>
  );
}
