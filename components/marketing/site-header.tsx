// -----------------------------------------------------------------------------
// @file: components/marketing/site-header.tsx
// @purpose: Shared sticky navigation header for all marketing pages
// -----------------------------------------------------------------------------

"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

const NAV_LINKS = [
  { href: "/how-it-works", label: "How it works?" },
  { href: "/pricing", label: "Pricing" },
  { href: "/showcase", label: "Showcase" },
  { href: "/#faq", label: "FAQs" },
  { href: "/blog", label: "Blog" },
];

type SiteHeaderProps = {
  /** Highlight the active page in the nav (match by label). */
  activePage?: string;
};

export function SiteHeader({ activePage }: SiteHeaderProps = {}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  const signInHref = isDemoMode ? "/debug/demo-user" : "/login";

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--bb-border-subtle)] bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        {/* Logo */}
        <Link href="/" className="flex-shrink-0">
          <Image
            src="/brandbite-logo.svg"
            alt="Brandbite"
            width={140}
            height={35}
            priority
            className="h-7 w-auto"
          />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`text-sm font-medium transition-colors ${
                activePage === l.label
                  ? "text-[var(--bb-primary)]"
                  : "text-[var(--bb-text-secondary)] hover:text-[var(--bb-secondary)]"
              }`}
            >
              {l.label}
            </Link>
          ))}
          <Link
            href={signInHref}
            className="rounded-full bg-[var(--bb-secondary)] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#333]"
          >
            Sign in
          </Link>
        </nav>

        {/* Mobile hamburger */}
        <button
          type="button"
          className="flex h-8 w-8 flex-col items-center justify-center gap-1 md:hidden"
          aria-label="Toggle navigation"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          <span
            className={`block h-0.5 w-5 rounded-full bg-[var(--bb-secondary)] transition-transform duration-200 ${mobileOpen ? "translate-y-[6px] rotate-45" : ""}`}
          />
          <span
            className={`block h-0.5 w-5 rounded-full bg-[var(--bb-secondary)] transition-opacity duration-200 ${mobileOpen ? "opacity-0" : ""}`}
          />
          <span
            className={`block h-0.5 w-5 rounded-full bg-[var(--bb-secondary)] transition-transform duration-200 ${mobileOpen ? "-translate-y-[6px] -rotate-45" : ""}`}
          />
        </button>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <nav className="border-t border-[var(--bb-border-subtle)] bg-white px-6 py-4 md:hidden">
          <div className="flex flex-col gap-3">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                className={`text-sm font-medium ${
                  activePage === l.label
                    ? "text-[var(--bb-primary)]"
                    : "text-[var(--bb-text-secondary)]"
                }`}
              >
                {l.label}
              </Link>
            ))}
            <Link
              href={signInHref}
              onClick={() => setMobileOpen(false)}
              className="mt-2 rounded-full bg-[var(--bb-secondary)] px-5 py-2 text-center text-sm font-semibold text-white"
            >
              Sign in
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
