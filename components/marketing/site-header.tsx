// -----------------------------------------------------------------------------
// @file: components/marketing/site-header.tsx
// @purpose: Shared floating glass navigation header for all marketing pages.
//           Matches the `brandbite-main` frame in Figma — a translucent
//           pill-shaped container that floats ~16–24px from the top edge,
//           with backdrop-blur + saturation boost for "Apple Liquid Glass"
//           style vibrance.
// -----------------------------------------------------------------------------

"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

const NAV_LINKS = [
  { href: "/how-it-works", label: "How it works?" },
  { href: "/pricing", label: "Pricing" },
  { href: "/showcase", label: "Showcase" },
  { href: "/faq", label: "FAQs" },
  { href: "/blog", label: "Blog" },
];

type SiteHeaderProps = {
  /** Highlight the active page in the nav (match by label). */
  activePage?: string;
};

/**
 * The glass-pill + drop-shadow class string is extracted so the mobile
 * dropdown (which is a sibling pill below the main one) stays visually
 * consistent with the nav bar itself. Changing the background tint,
 * blur amount, or border color should be done here once.
 */
const GLASS_PILL =
  "rounded-full border border-white/40 bg-white/30 shadow-[0_8px_32px_rgba(0,0,0,0.08)] backdrop-blur-xl backdrop-saturate-150";

export function SiteHeader({ activePage }: SiteHeaderProps = {}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  const signInHref = isDemoMode ? "/debug/demo-user" : "/login";

  return (
    // `pointer-events-none` on the outer header so clicks in the empty
    // space next to the floating pill pass through to the content
    // beneath. Children that need to be interactive opt back in with
    // `pointer-events-auto`.
    <header className="pointer-events-none sticky top-0 z-50">
      {/* Floating pill */}
      <div className="pointer-events-auto mx-auto mt-4 max-w-6xl px-4 md:mt-6 md:px-6">
        <div
          className={`flex items-center justify-between gap-4 px-4 py-3 md:px-6 md:py-4 ${GLASS_PILL}`}
        >
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
      </div>

      {/* Mobile dropdown — a second floating glass panel below the pill.
          Using a slightly higher opacity background so the stacked nav
          links stay readable. rounded-2xl instead of rounded-full since
          a tall multi-line panel shouldn't be a pill. */}
      {mobileOpen && (
        <div className="pointer-events-auto mx-auto mt-2 max-w-6xl px-4 md:hidden">
          <nav className="rounded-2xl border border-white/40 bg-white/60 px-6 py-4 shadow-[0_8px_32px_rgba(0,0,0,0.08)] backdrop-blur-xl backdrop-saturate-150">
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
        </div>
      )}
    </header>
  );
}
