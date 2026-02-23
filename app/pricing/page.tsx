// -----------------------------------------------------------------------------
// @file: app/pricing/page.tsx
// @purpose: Dedicated pricing page — Figma brandbite-pricing frame
// -----------------------------------------------------------------------------

"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const NAV_LINKS = [
  { href: "/#how-it-works", label: "How it works?" },
  { href: "/pricing", label: "Pricing" },
  { href: "/showcase", label: "Showcase" },
  { href: "/faq", label: "FAQs" },
  { href: "/blog", label: "Blog" },
];

const PLANS = [
  {
    name: "Starter",
    price: 495,
    yearlyPrice: 396,
    tagline: "Best for startups and solo founders",
    features: [
      "1 active creative request at a time",
      "Unlimited revisions & brand asset storage",
      "Delivery in 2\u20133 business days per task",
    ],
    cta: "GET STARTED",
    subtitle: "\u201cPause or cancel anytime.\u201d",
    badge: null,
  },
  {
    name: "Brand",
    price: 995,
    yearlyPrice: 796,
    tagline: "Perfect for marketing teams & growing brands",
    features: [
      "2 active creative requests simultaneously",
      "Priority turnaround (1\u20132 business days)",
      "Slack workspace access for real-time collaboration",
    ],
    cta: "CHOOSE BRAND",
    subtitle: "\u201cMost popular choice for performance teams.\u201d",
    badge: "Best Value",
  },
  {
    name: "Full",
    price: 1895,
    yearlyPrice: 1516,
    tagline: "For agencies and fast-moving creative teams",
    features: [
      "Unlimited active requests & team seats",
      "Dedicated project manager & creative lead",
      "Custom brand portal + asset library integration",
    ],
    cta: "GO WITH FULL",
    subtitle: "\u201cBest value for high-volume creative production.\u201d",
    badge: null,
  },
];

const TESTIMONIALS = [
  {
    quote:
      "We replaced our entire freelance pipeline with Brandbite. Seamless experience, incredible turnaround.",
    author: "Sara L., Growth Manager",
  },
  {
    quote:
      "Brandbite gave us back 20+ hours a week. Our creative output tripled within the first month.",
    author: "Mark T., Head of Marketing",
  },
  {
    quote:
      "The quality and speed from Brandbite's team is unmatched. It feels like having an in-house studio.",
    author: "Nina K., Brand Director",
  },
];

type CompareValue = boolean | string;

const COMPARE_ROWS: {
  label: string;
  starter: CompareValue;
  brand: CompareValue;
  full: CompareValue;
}[] = [
  { label: "Starter templates", starter: true, brand: true, full: true },
  {
    label: "Users",
    starter: "1 site",
    brand: "Up to 5 sites",
    full: "Unlimited usage",
  },
  {
    label: "Figma files",
    starter: false,
    brand: "Included",
    full: "Included",
  },
  {
    label: "License",
    starter: "Personal use",
    brand: "Commercial use",
    full: "Extended + client transfer",
  },
  {
    label: "Components library",
    starter: false,
    brand: "Partial access",
    full: "Full access",
  },
  {
    label: "New templates monthly",
    starter: false,
    brand: true,
    full: true,
  },
  {
    label: "Support",
    starter: "Community only",
    brand: "Email support",
    full: "Priority 24/7 support",
  },
  { label: "CMS-ready layouts", starter: true, brand: true, full: true },
  {
    label: "Team access",
    starter: false,
    brand: false,
    full: "Team dashboard included",
  },
];

const FOOTER_COLS = [
  {
    title: "Platform",
    links: ["Plans & Pricing", "Personal AI Manager", "AI Business Writer"],
  },
  { title: "Company", links: ["Blog", "Careers", "News"] },
  {
    title: "Resources",
    links: ["Documentation", "Papers", "Press Conferences"],
  },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PricingPage() {
  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  const signInHref = isDemoMode ? "/debug/demo-user" : "/login";

  return (
    <div className="min-h-screen bg-white text-[var(--bb-secondary)]">
      <PricingHeader signInHref={signInHref} />
      <HeroCards />
      <TrustedBy />
      <ComparePlans />
      <PricingFooter />
    </div>
  );
}

// ===========================================================================
// Header
// ===========================================================================

function PricingHeader({ signInHref }: { signInHref: string }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--bb-border-subtle)] bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
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

        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className={`text-sm font-medium transition-colors ${
                l.label === "Pricing"
                  ? "text-[var(--bb-primary)]"
                  : "text-[var(--bb-text-secondary)] hover:text-[var(--bb-secondary)]"
              }`}
            >
              {l.label}
            </a>
          ))}
          <Link
            href={signInHref}
            className="rounded-full bg-[var(--bb-secondary)] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#333]"
          >
            Sign in
          </Link>
        </nav>

        <button
          type="button"
          className="flex h-8 w-8 flex-col items-center justify-center gap-1 md:hidden"
          aria-label="Toggle navigation"
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

      {mobileOpen && (
        <nav className="border-t border-[var(--bb-border-subtle)] bg-white px-6 py-4 md:hidden">
          <div className="flex flex-col gap-3">
            {NAV_LINKS.map((l) => (
              <a
                key={l.label}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                className={`text-sm font-medium ${
                  l.label === "Pricing"
                    ? "text-[var(--bb-primary)]"
                    : "text-[var(--bb-text-secondary)]"
                }`}
              >
                {l.label}
              </a>
            ))}
            <Link
              href="/login"
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

// ===========================================================================
// Hero + Pricing cards
// ===========================================================================

function HeroCards() {
  const [yearly, setYearly] = useState(false);

  return (
    <section className="relative overflow-hidden bg-white px-6 pt-14 pb-20 sm:pt-20 sm:pb-28">
      {/* Bitemark background blob */}
      <img
        src="/bitemark.svg"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-0 h-full w-auto max-w-none object-cover object-left-top select-none"
      />

      <div className="relative mx-auto max-w-5xl">
        {/* Title */}
        <h1 className="font-brand mb-6 text-center text-3xl tracking-tight sm:text-4xl">
          Brandbite <span className="font-bold">Pricing</span>
        </h1>

        {/* Buy Yearly toggle */}
        <div className="mb-10 flex items-center justify-center gap-3">
          <span
            className={`text-sm font-medium ${!yearly ? "text-[var(--bb-secondary)]" : "text-[var(--bb-text-muted)]"}`}
          >
            Monthly
          </span>
          <button
            type="button"
            onClick={() => setYearly(!yearly)}
            className={`relative h-6 w-11 rounded-full transition-colors ${yearly ? "bg-[var(--bb-primary)]" : "bg-[var(--bb-border)]"}`}
            aria-label="Toggle yearly billing"
          >
            <span
              className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${yearly ? "translate-x-5" : ""}`}
            />
          </button>
          <span
            className={`text-sm font-medium ${yearly ? "text-[var(--bb-secondary)]" : "text-[var(--bb-text-muted)]"}`}
          >
            Buy Yearly
          </span>
          {yearly && (
            <span className="rounded-full bg-[var(--bb-primary)] px-2.5 py-0.5 text-[10px] font-bold text-white">
              Save 20%
            </span>
          )}
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {PLANS.map((plan) => {
            const displayPrice = yearly ? plan.yearlyPrice : plan.price;
            return (
              <div key={plan.name} className="relative flex flex-col rounded-3xl bg-[#eae6f1] p-7">
                {/* Best Value badge */}
                {plan.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#7cb342] px-3 py-1 text-[10px] font-bold text-white shadow-sm">
                    {plan.badge}
                  </span>
                )}

                {/* Name + price */}
                <div className="mb-2 flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-[var(--bb-secondary)]">{plan.name}</h3>
                    <p className="mt-0.5 text-xs leading-snug text-[var(--bb-text-secondary)]">
                      {plan.tagline}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-extrabold text-[var(--bb-secondary)]">
                      $ {displayPrice.toLocaleString()}
                    </span>
                    <span className="block text-[10px] text-[var(--bb-text-muted)]">per month</span>
                  </div>
                </div>

                {/* Separator dash */}
                <div className="mb-6 h-0.5 w-6 bg-[var(--bb-secondary)]" />

                {/* Features */}
                <p className="mb-3 text-[11px] font-bold text-[var(--bb-secondary)]">
                  Plan includes :
                </p>
                <ul className="mb-6 flex-1 space-y-2.5">
                  {plan.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-start gap-2 text-[13px] leading-snug text-[var(--bb-text-secondary)]"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        className="mt-0.5 flex-shrink-0"
                      >
                        <path
                          d="M5 13l4 4L19 7"
                          stroke="var(--bb-text-secondary)"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>

                {/* See all features */}
                <a
                  href="#compare"
                  className="mb-6 text-xs font-bold text-[var(--bb-secondary)] hover:underline"
                >
                  See all features
                </a>

                {/* CTA */}
                <Link
                  href="/login"
                  className="block rounded-full bg-[var(--bb-primary)] px-6 py-2.5 text-center text-[11px] font-bold tracking-wider text-white uppercase transition-colors hover:bg-[var(--bb-primary-hover)]"
                >
                  {plan.cta}
                </Link>

                {/* Subtitle */}
                <p className="mt-3 text-center text-[10px] leading-snug text-[var(--bb-text-muted)] italic">
                  {plan.subtitle}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ===========================================================================
// Trusted By section
// ===========================================================================

function TrustedBy() {
  const [activeIdx, setActiveIdx] = useState(0);
  const t = TESTIMONIALS[activeIdx];

  return (
    <section className="bg-white px-6 py-20 sm:py-24">
      <div className="mx-auto grid max-w-5xl grid-cols-1 items-center gap-12 lg:grid-cols-2">
        {/* Image placeholder */}
        <div className="aspect-square overflow-hidden rounded-2xl bg-[#e8dff5]">
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white/40">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--bb-text-muted)"
                  strokeWidth="1.5"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
              </div>
              <span className="text-sm font-medium text-[var(--bb-text-muted)]">Brand visual</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div>
          <h2 className="font-brand text-3xl font-bold tracking-tight sm:text-4xl">
            Trusted by 120+ growing brands
          </h2>

          {/* Quote */}
          <div className="mt-8">
            <svg width="32" height="24" viewBox="0 0 32 24" fill="var(--bb-secondary)">
              <path d="M0 24V13.7C0 4.6 5.4 0 13.2 0l1 3.4C9 4.6 7.2 7.8 7 11.6h5.6V24H0zm18.4 0V13.7C18.4 4.6 23.8 0 31.6 0l1 3.4c-5.2 1.2-7 4.4-7.2 8.2H31V24H18.4z" />
            </svg>
            <p className="mt-4 text-base leading-relaxed text-[var(--bb-text-secondary)]">
              {t.quote}
            </p>
            <p className="mt-3 text-sm font-semibold text-[var(--bb-secondary)]">
              &mdash; {t.author}
            </p>
          </div>

          {/* Dots */}
          <div className="mt-6 flex gap-2">
            {TESTIMONIALS.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActiveIdx(i)}
                className={`h-2.5 w-2.5 rounded-full transition-colors ${
                  i === activeIdx ? "bg-[var(--bb-primary)]" : "bg-[var(--bb-border)]"
                }`}
                aria-label={`Testimonial ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ===========================================================================
// Compare Plans table
// ===========================================================================

function ComparePlans() {
  return (
    <section id="compare" className="bg-[var(--bb-bg-page)] px-6 py-20 sm:py-24">
      <div className="mx-auto max-w-5xl">
        <h2 className="font-brand mb-10 text-center text-3xl tracking-tight sm:text-4xl">
          Compare <span className="font-bold">Plans</span>
        </h2>

        {/* Column headers */}
        <div className="mb-2 grid grid-cols-4 gap-4 px-4 text-xs font-bold text-[var(--bb-text-muted)] uppercase">
          <div>Overview</div>
          <div className="text-center">Starter</div>
          <div className="text-center">Brand</div>
          <div className="text-center">Full</div>
        </div>

        {/* Divider */}
        <div className="h-px bg-[var(--bb-border)]" />

        {/* Rows */}
        {COMPARE_ROWS.map((row, i) => (
          <div key={i}>
            <div className="grid grid-cols-4 gap-4 px-4 py-3.5 text-sm">
              {/* Label */}
              <div className="flex items-center gap-1 font-medium text-[var(--bb-secondary)]">
                {row.label}
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="flex-shrink-0 text-[var(--bb-text-muted)]"
                >
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
                  <path
                    d="M12 16v-4m0-4h.01"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </div>

              {/* Values */}
              {[row.starter, row.brand, row.full].map((val, j) => (
                <div key={j} className="flex items-center justify-center">
                  {val === true ? (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--bb-primary)]">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M5 13l4 4L19 7"
                          stroke="white"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  ) : val === false ? (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--bb-border)]">
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M18 6L6 18M6 6l12 12"
                          stroke="white"
                          strokeWidth="3"
                          strokeLinecap="round"
                        />
                      </svg>
                    </span>
                  ) : (
                    <span className="text-center text-xs text-[var(--bb-text-secondary)]">
                      {val}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="h-px bg-[var(--bb-border-subtle)]" />
          </div>
        ))}
      </div>
    </section>
  );
}

// ===========================================================================
// Footer
// ===========================================================================

function PricingFooter() {
  return (
    <footer className="bg-[#2A2A2D] text-white">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-6">
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

          {FOOTER_COLS.map((col) => (
            <div key={col.title}>
              <h4 className="mb-3 text-xs font-semibold tracking-wider text-gray-400 uppercase">
                {col.title}
              </h4>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="text-sm text-gray-300 transition-colors hover:text-white"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}

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

      <div className="bg-[var(--bb-primary)] px-6 py-3">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 sm:flex-row">
          <p className="text-xs text-white/80">
            &copy; {new Date().getFullYear()} Brandbite. All rights reserved.
          </p>
          <div className="flex gap-4 text-xs text-white/80">
            <a href="#" className="hover:text-white">
              Terms of Service
            </a>
            <a href="#" className="hover:text-white">
              Privacy Policy
            </a>
            <a href="#" className="hover:text-white">
              Cookies
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
