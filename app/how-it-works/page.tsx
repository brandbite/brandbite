// -----------------------------------------------------------------------------
// @file: app/how-it-works/page.tsx
// @purpose: How it works page — explains the BrandBite creative workflow
// -----------------------------------------------------------------------------

"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const NAV_LINKS = [
  { href: "/how-it-works", label: "How it works?" },
  { href: "/pricing", label: "Pricing" },
  { href: "/#showcase", label: "Showcase" },
  { href: "/#faq", label: "FAQs" },
  { href: "#", label: "Blog" },
];

const STEPS = [
  {
    number: "01",
    title: "Submit a creative request",
    headline: "Tell us what you need.",
    description:
      "Log in to your Brandbite dashboard, choose a creative category, and describe what you're looking for. Attach brand guidelines, mood boards, or references \u2014 the more context, the faster the result.",
    details: [
      "Choose from 20+ creative categories",
      "Attach brand guidelines & references",
      "Set priority level and deadline",
      "Add collaborators from your team",
    ],
  },
  {
    number: "02",
    title: "Get matched instantly",
    headline: "We assign the perfect creative.",
    description:
      "Within minutes, our platform matches your request with a vetted European creative who specialises in exactly what you need. Your dedicated team lead oversees quality from start to finish.",
    details: [
      "Matched by skill, style & availability",
      "Vetted creatives with 5+ years experience",
      "Dedicated team lead for every account",
      "Work begins within 24 hours",
    ],
  },
  {
    number: "03",
    title: "Review & revise endlessly",
    headline: "Iterate until it\u2019s perfect.",
    description:
      "Receive your first draft in 24\u201348 hours. Leave feedback directly on the deliverable, request revisions, and approve the final version \u2014 all inside your dashboard. No revision limits, ever.",
    details: [
      "First draft in 24\u201348 hours",
      "Inline feedback & annotation tools",
      "Unlimited revisions on every plan",
      "Download source files instantly",
    ],
  },
];

const REQUEST_TYPES = [
  { icon: "palette", label: "Brand identity", desc: "Logos, brand books, color systems" },
  { icon: "layout", label: "Web design", desc: "Landing pages, UI kits, prototypes" },
  { icon: "megaphone", label: "Social media", desc: "Posts, stories, ad creatives" },
  { icon: "package", label: "Packaging", desc: "Product packaging, labels, mockups" },
  { icon: "presentation", label: "Pitch decks", desc: "Investor decks, sales presentations" },
  { icon: "video", label: "Motion & video", desc: "Animations, reels, video editing" },
  { icon: "mail", label: "Email design", desc: "Newsletters, drip campaigns, templates" },
  { icon: "print", label: "Print design", desc: "Brochures, flyers, business cards" },
];

const COMPARISONS = [
  {
    label: "Time to first draft",
    traditional: "5\u201310 days",
    brandbite: "24\u201348 hours",
  },
  {
    label: "Revision rounds",
    traditional: "2\u20133 included",
    brandbite: "Unlimited",
  },
  {
    label: "Monthly cost",
    traditional: "$3,000\u2013$8,000+",
    brandbite: "From $495/mo",
  },
  {
    label: "Onboarding",
    traditional: "Weeks of briefing",
    brandbite: "Submit & go",
  },
  {
    label: "Cancellation",
    traditional: "Long-term contracts",
    brandbite: "Pause or cancel anytime",
  },
  {
    label: "Team management",
    traditional: "You manage freelancers",
    brandbite: "Dedicated team lead",
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
// Icons (inline SVGs for request types)
// ---------------------------------------------------------------------------

function RequestIcon({ type }: { type: string }) {
  const cls = "h-6 w-6 text-[var(--bb-primary)]";
  switch (type) {
    case "palette":
      return (
        <svg
          className={cls}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="13.5" cy="6.5" r="0.5" fill="currentColor" />
          <circle cx="17.5" cy="10.5" r="0.5" fill="currentColor" />
          <circle cx="8.5" cy="7.5" r="0.5" fill="currentColor" />
          <circle cx="6.5" cy="12" r="0.5" fill="currentColor" />
          <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 011.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
        </svg>
      );
    case "layout":
      return (
        <svg
          className={cls}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="9" y1="21" x2="9" y2="9" />
        </svg>
      );
    case "megaphone":
      return (
        <svg
          className={cls}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
      );
    case "package":
      return (
        <svg
          className={cls}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M16.5 9.4l-9-5.19M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
      );
    case "presentation":
      return (
        <svg
          className={cls}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      );
    case "video":
      return (
        <svg
          className={cls}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="23 7 16 12 23 17 23 7" />
          <rect x="1" y="5" width="15" height="14" rx="2" />
        </svg>
      );
    case "mail":
      return (
        <svg
          className={cls}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          <polyline points="22,6 12,13 2,6" />
        </svg>
      );
    case "print":
      return (
        <svg
          className={cls}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 6 2 18 2 18 9" />
          <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
          <rect x="6" y="14" width="12" height="8" />
        </svg>
      );
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function HowItWorksPage() {
  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  const signInHref = isDemoMode ? "/debug/demo-user" : "/login";

  return (
    <div className="min-h-screen bg-white text-[var(--bb-secondary)]">
      <HiwHeader signInHref={signInHref} />
      <HeroSection />
      <StepsSection />
      <RequestTypesSection />
      <ComparisonSection />
      <CtaSection signInHref={signInHref} />
      <HiwFooter />
    </div>
  );
}

// ===========================================================================
// Header
// ===========================================================================

function HiwHeader({ signInHref }: { signInHref: string }) {
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
                l.label === "How it works?"
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
                  l.label === "How it works?"
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
// Hero
// ===========================================================================

function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-white px-6 pt-16 pb-20 sm:pt-24 sm:pb-28">
      {/* Bitemark background */}
      <img
        src="/bitemark.svg"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-0 h-full w-auto max-w-none object-cover object-left-top select-none"
      />

      <div className="relative mx-auto max-w-3xl text-center">
        <p className="mb-2 text-sm font-semibold tracking-wider text-[var(--bb-primary)] uppercase">
          How it works
        </p>
        <h1 className="font-brand text-4xl leading-tight font-bold tracking-tight sm:text-5xl">
          From brief to final creative <br className="hidden sm:block" />
          in three simple steps.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-[var(--bb-text-secondary)] sm:text-lg">
          No hiring, no briefing calls, no scope creep. Just submit what you need, and our European
          creative team delivers.
        </p>
      </div>
    </section>
  );
}

// ===========================================================================
// 3 Steps (expanded)
// ===========================================================================

function StepsSection() {
  return (
    <section className="bg-[var(--bb-bg-page)] px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-5xl">
        {STEPS.map((step, i) => {
          const isEven = i % 2 === 1;
          return (
            <div
              key={step.number}
              className={`mb-24 grid grid-cols-1 items-center gap-12 last:mb-0 lg:grid-cols-2 ${
                isEven ? "lg:direction-rtl" : ""
              }`}
            >
              {/* Image placeholder */}
              <div className={`${isEven ? "lg:order-2" : ""}`}>
                <div className="aspect-[4/3] overflow-hidden rounded-3xl bg-[#eae6f1]">
                  <div className="flex h-full items-center justify-center">
                    <div className="text-center">
                      <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white/50 text-3xl font-bold text-[var(--bb-secondary)]">
                        {step.number}
                      </div>
                      <span className="text-sm font-medium text-[var(--bb-text-muted)]">
                        {step.title}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className={`${isEven ? "lg:order-1" : ""}`}>
                <div className="mb-3 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--bb-primary)] text-sm font-bold text-white">
                    {step.number}
                  </span>
                  <span className="text-xs font-bold tracking-wider text-[var(--bb-text-muted)] uppercase">
                    Step {step.number}
                  </span>
                </div>

                <h2 className="font-brand text-2xl font-bold tracking-tight sm:text-3xl">
                  {step.headline}
                </h2>

                <p className="mt-4 text-sm leading-relaxed text-[var(--bb-text-secondary)] sm:text-base">
                  {step.description}
                </p>

                {/* Detail checklist */}
                <ul className="mt-6 space-y-3">
                  {step.details.map((d) => (
                    <li
                      key={d}
                      className="flex items-start gap-2.5 text-sm text-[var(--bb-secondary)]"
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        className="mt-0.5 flex-shrink-0"
                      >
                        <circle cx="12" cy="12" r="10" fill="var(--bb-primary)" fillOpacity="0.1" />
                        <path
                          d="M8 12l3 3 5-5"
                          stroke="var(--bb-primary)"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      {d}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ===========================================================================
// What you can request
// ===========================================================================

function RequestTypesSection() {
  return (
    <section className="bg-white px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-5xl">
        <div className="mb-12 text-center">
          <p className="mb-2 text-sm font-semibold tracking-wider text-[var(--bb-primary)] uppercase">
            Creative categories
          </p>
          <h2 className="font-brand text-3xl font-bold tracking-tight sm:text-4xl">
            What you can request
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm text-[var(--bb-text-secondary)] sm:text-base">
            From quick social posts to full brand identities, our creatives handle it all under one
            subscription.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {REQUEST_TYPES.map((r) => (
            <div
              key={r.label}
              className="group rounded-2xl border border-[var(--bb-border-subtle)] bg-white p-5 transition-all hover:border-[var(--bb-primary)] hover:shadow-md"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--bb-primary)]/10">
                <RequestIcon type={r.icon} />
              </div>
              <h3 className="mb-1 text-sm font-bold text-[var(--bb-secondary)]">{r.label}</h3>
              <p className="text-xs leading-relaxed text-[var(--bb-text-muted)]">{r.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ===========================================================================
// Brandbite vs Traditional
// ===========================================================================

function ComparisonSection() {
  return (
    <section className="bg-[var(--bb-bg-page)] px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-3xl">
        <div className="mb-12 text-center">
          <p className="mb-2 text-sm font-semibold tracking-wider text-[var(--bb-primary)] uppercase">
            Why switch
          </p>
          <h2 className="font-brand text-3xl font-bold tracking-tight sm:text-4xl">
            Brandbite vs. traditional hiring
          </h2>
        </div>

        {/* Table header */}
        <div className="mb-1 grid grid-cols-3 gap-4 px-4 text-[11px] font-bold tracking-wider text-[var(--bb-text-muted)] uppercase">
          <div />
          <div className="text-center">Traditional</div>
          <div className="text-center text-[var(--bb-primary)]">Brandbite</div>
        </div>
        <div className="h-px bg-[var(--bb-border)]" />

        {COMPARISONS.map((row, i) => (
          <div key={i}>
            <div className="grid grid-cols-3 gap-4 px-4 py-4 text-sm">
              <div className="font-semibold text-[var(--bb-secondary)]">{row.label}</div>
              <div className="text-center text-[var(--bb-text-muted)]">{row.traditional}</div>
              <div className="text-center font-semibold text-[var(--bb-primary)]">
                {row.brandbite}
              </div>
            </div>
            <div className="h-px bg-[var(--bb-border-subtle)]" />
          </div>
        ))}
      </div>
    </section>
  );
}

// ===========================================================================
// CTA
// ===========================================================================

function CtaSection({ signInHref }: { signInHref: string }) {
  return (
    <section className="relative overflow-hidden bg-[var(--bb-secondary)] px-6 py-20 text-center text-white sm:py-28">
      {/* Subtle decorative blob */}
      <div className="pointer-events-none absolute -top-20 -right-20 h-80 w-80 rounded-full bg-white/5" />
      <div className="pointer-events-none absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-white/5" />

      <div className="relative mx-auto max-w-2xl">
        <h2 className="font-brand text-3xl font-bold tracking-tight sm:text-4xl">
          Ready to transform your creative workflow?
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-white/70">
          Join 120+ brands that replaced freelancers, agencies, and in-house bottlenecks with one
          flat-rate creative subscription.
        </p>
        <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link
            href={signInHref}
            className="inline-block rounded-full bg-[var(--bb-primary)] px-8 py-3.5 text-sm font-bold tracking-wide uppercase shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl"
          >
            Get Started
          </Link>
          <Link
            href="/pricing"
            className="inline-block rounded-full border border-white/30 px-8 py-3.5 text-sm font-semibold transition-colors hover:bg-white/10"
          >
            View Pricing
          </Link>
        </div>
      </div>
    </section>
  );
}

// ===========================================================================
// Footer
// ===========================================================================

function HiwFooter() {
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
