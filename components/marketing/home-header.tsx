// -----------------------------------------------------------------------------
// @file: components/marketing/home-header.tsx
// @purpose: Marketing header for the redesigned homepage + coming-soon page.
//           Desktop nav collapses into a burger menu below 900px, the narrowest
//           width where the full nav and CTA fit on one row.
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-07-12
// -----------------------------------------------------------------------------

"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

// Pages that exist in the new design go to their real routes; everything
// still being redesigned points at /meet until its page ships. Showcase returns
// here when its redesigned page is ready.
const NAV_LINKS = [
  { label: "How it works?", href: "/#how-it-works" },
  { label: "Pricing", href: "/meet" },
  { label: "FAQs", href: "/faq" },
  { label: "Blog", href: "/blog" },
];

export function HomeHeader({ active }: { active?: string } = {}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="flex flex-row items-center gap-[89px] px-14 pt-[37px] max-[1179px]:gap-8 max-[1179px]:px-8 max-[1179px]:pt-6 max-[899px]:flex-wrap max-[899px]:gap-4 max-[899px]:px-5 max-[899px]:pt-5">
      <Link href="/" className="flex shrink-0" aria-label="Brandbite home">
        <Image src="/brandbite-logo.svg" alt="Brandbite" width={145} height={30} priority />
      </Link>
      <nav
        className={`flex flex-1 flex-row items-center justify-center gap-[50px] max-[1179px]:gap-7 ${
          menuOpen
            ? "max-[899px]:order-3 max-[899px]:flex max-[899px]:basis-full max-[899px]:flex-col max-[899px]:items-start max-[899px]:justify-start max-[899px]:gap-[22px] max-[899px]:border-t max-[899px]:border-[#D7D8DD] max-[899px]:px-1 max-[899px]:pt-[18px] max-[899px]:pb-3"
            : "max-[899px]:hidden"
        }`}
        onClick={() => setMenuOpen(false)}
      >
        {NAV_LINKS.map((link) => (
          <Link
            key={link.label}
            href={link.href}
            className={`font-brand text-xl leading-none whitespace-nowrap transition-colors ${
              active === link.label
                ? "font-bold text-[#8D5BFF]"
                : "text-[#1F2024] hover:text-[#FF6426]"
            }`}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <Link
        href="/login?mode=signup"
        className="font-brand flex h-10 w-[141px] shrink-0 flex-row items-center justify-center gap-2.5 rounded-[10px] bg-[#1F2024] px-5 py-2.5 text-xl leading-none font-bold text-white transition-colors hover:bg-[#FF6426] max-[899px]:ml-auto max-[899px]:h-9 max-[899px]:w-auto max-[899px]:px-3.5 max-[899px]:py-2 max-[899px]:text-base"
      >
        Start Now!
      </Link>
      <button
        type="button"
        aria-label="Menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
        className="hidden h-10 w-10 shrink-0 cursor-pointer flex-col items-center justify-center gap-[5px] rounded-[10px] border-none bg-transparent p-0 max-[899px]:flex"
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
