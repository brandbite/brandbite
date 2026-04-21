// -----------------------------------------------------------------------------
// @file: components/marketing/site-footer.tsx
// @purpose: Shared footer for all marketing pages
// -----------------------------------------------------------------------------

import Image from "next/image";
import Link from "next/link";

// The bottom orange bar repeats a subset of the Legal column so visitors
// reach legal copy from the end of any marketing page without scrolling
// past the link grid. Keep in sync with the Legal column above.
const BOTTOM_LEGAL_LINKS = [
  { label: "Terms of Service", href: "/terms" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Cookies", href: "/cookies" },
  { label: "Accessibility", href: "/accessibility" },
];

const FOOTER_COLS = [
  {
    title: "Platform",
    links: [
      { label: "How It Works", href: "/how-it-works" },
      { label: "Plans & Pricing", href: "/pricing" },
      { label: "Showcase", href: "/showcase" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Blog", href: "/blog" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Documentation", href: "/documentation" },
      { label: "FAQs", href: "/faq" },
      { label: "News", href: "/news" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy policy", href: "/privacy" },
      { label: "Terms of service", href: "/terms" },
      { label: "Cookie policy", href: "/cookies" },
      { label: "Accessibility", href: "/accessibility" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="bg-[#2A2A2D] text-white">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-6">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Image
              src="/brandbite-logo.svg"
              alt="Brandbite"
              width={140}
              height={35}
              className="h-7 w-auto brightness-0 invert"
            />
            <p className="mt-3 text-sm leading-relaxed text-gray-400">
              All your creatives, <span className="text-[var(--bb-primary)]">one subscription</span>
            </p>
          </div>

          {/* Link columns */}
          {FOOTER_COLS.map((col) => (
            <div key={col.title}>
              <h4 className="mb-3 text-xs font-semibold tracking-wider text-gray-400 uppercase">
                {col.title}
              </h4>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-gray-300 transition-colors hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Get the app */}
          <div>
            <h4 className="mb-3 text-xs font-semibold tracking-wider text-gray-400 uppercase">
              Get the app
            </h4>
            <div className="flex flex-col gap-2">
              <a
                href="#"
                className="inline-flex items-center gap-2 rounded-lg border border-gray-600 px-3 py-2 text-xs text-gray-300 transition-colors hover:border-gray-400 hover:text-white"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
                </svg>
                Windows
              </a>
              <a
                href="#"
                className="inline-flex items-center gap-2 rounded-lg border border-gray-600 px-3 py-2 text-xs text-gray-300 transition-colors hover:border-gray-400 hover:text-white"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                </svg>
                macOS
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="bg-[var(--bb-primary)] px-6 py-3">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 sm:flex-row">
          <p className="text-xs text-white/80">
            &copy; {new Date().getFullYear()} Brandbite. All rights reserved.
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/80">
            {BOTTOM_LEGAL_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-white">
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
