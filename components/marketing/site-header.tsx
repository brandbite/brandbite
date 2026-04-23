// -----------------------------------------------------------------------------
// @file: components/marketing/site-header.tsx
// @purpose: Shared full-width liquid-glass navigation header for all
//           marketing pages. Spans the viewport; translucent white
//           background + heavy backdrop blur + saturation boost for an
//           Apple Liquid Glass feel; thin subtle bottom border gives
//           clean separation from page content when scrolled.
//
//           Previously tried a floating "pill" variant (PRs #177–#179)
//           but abandoned it — a pill with a translucent bg disappears
//           against a white page background. Full-width keeps the glass
//           effect reliable regardless of what's behind.
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
 * Liquid glass treatment. Tuned for two constraints:
 *   - Readable over any page content that scrolls behind (hence
 *     `bg-white/70` rather than a deeper translucency — enough to keep
 *     nav text crisp).
 *   - Glass effect stays visible even when behind-content is all white
 *     (hence the subtle `border-b` that always defines the bottom
 *     edge, regardless of what's behind).
 *
 * The `backdrop-blur-xl` (24px) is the dominant glass trait. Paired
 * with `backdrop-saturate-150` so colored content passing behind
 * picks up a small vibrance bump as it refracts through the bar — the
 * trick Apple uses in iOS / macOS to make the blur feel lively
 * instead of muddy.
 */
const GLASS_BAR =
  "sticky top-0 z-50 border-b border-black/[0.06] bg-white/70 backdrop-blur-xl backdrop-saturate-150";

export function SiteHeader({ activePage }: SiteHeaderProps = {}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  const signInHref = isDemoMode ? "/debug/demo-user" : "/login";

  return (
    <header className={GLASS_BAR}>
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 md:px-6">
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

      {/* Mobile dropdown — same glass treatment, flows naturally below
          the top bar inside the same sticky <header>. No separate panel
          needed since the bar is already full-width. */}
      {mobileOpen && (
        <nav className="border-t border-black/[0.06] px-4 py-4 md:hidden">
          <div className="mx-auto flex max-w-6xl flex-col gap-3">
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
