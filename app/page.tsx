// -----------------------------------------------------------------------------
// @file: app/page.tsx
// @purpose: Marketing landing page — Figma-based, creative-as-a-service
// -----------------------------------------------------------------------------

"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const NAV_LINKS = [
  { href: "#how-it-works", label: "How it works?" },
  { href: "#pricing", label: "Pricing" },
  { href: "/showcase", label: "Showcase" },
  { href: "#faq", label: "FAQs" },
  { href: "/blog", label: "Blog" },
];

const STEPS = [
  {
    title: "Submit a creative request",
    description: "Tell us what you need — logo, landing page, or ad visuals.",
  },
  {
    title: "Get matched instantly",
    description: "Your personal creative starts working within 24 hours.",
  },
  {
    title: "Review & revise endlessly",
    description: "Request changes until it's perfect. No limits.",
  },
];

const PLANS = [
  {
    name: "Starter",
    price: 495,
    tagline: "Best for startups and solo founders",
    features: [
      "1 active creative request at a time",
      "Unlimited revisions & brand asset storage",
      "Delivery in 2–3 business days per task",
    ],
    cta: "GET STARTED",
    subtitle: "\u201cPause or cancel anytime.\u201d",
  },
  {
    name: "Brand",
    price: 995,
    tagline: "Perfect for marketing teams & growing brands",
    features: [
      "2 active creative requests simultaneously",
      "Priority turnaround (1–2 business days)",
      "Slack workspace access for real-time collaboration",
    ],
    cta: "CHOOSE BRAND",
    subtitle: "\u201cMost popular choice for performance teams.\u201d",
  },
  {
    name: "Full",
    price: 1895,
    tagline: "For agencies and fast-moving creative teams",
    features: [
      "Unlimited active requests & team seats",
      "Dedicated project manager & creative lead",
      "Custom brand portal + asset library integration",
    ],
    cta: "GO WITH FULL",
    subtitle: "\u201cBest value for high-volume creative production.\u201d",
  },
];

const WHY_ITEMS = [
  "Fast turnaround (24–48 h per request)",
  "Direct Slack communication",
  "Brand guidelines",
  "Flexible subscription — pause anytime",
  "Access to top European talent",
];

const FAQS = [
  {
    q: "How fast will I get my creatives?",
    a: "Most requests are completed within 24–48 hours. Larger projects like brand identity guides or motion videos may take 3–5 business days depending on complexity.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. You can pause or cancel your subscription at any time — no long-term contracts, no cancellation fees. Your work and assets remain yours.",
  },
  {
    q: "What if I don't like the creative?",
    a: "No worries! Every plan includes unlimited revisions. We'll keep iterating until you're 100% happy with the result.",
  },
  {
    q: "Do you work with agencies?",
    a: "Absolutely. Many agencies use Brandbite as their white-label creative arm. We offer agency-friendly plans with multi-seat access and dedicated account managers.",
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
// Component
// ---------------------------------------------------------------------------

export default function LandingPage() {
  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  const signInHref = isDemoMode ? "/debug/demo-user" : "/login";

  return (
    <div className="min-h-screen bg-white text-[var(--bb-secondary)]">
      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <SiteHeader signInHref={signInHref} />

      {/* ─── Hero + How it works + Bitemark (one continuous area) ──────── */}
      <HeroBitemarkSection signInHref={signInHref} />

      {/* ─── Pricing ────────────────────────────────────────────────────── */}
      <PricingSection />

      {/* ─── Showcase ───────────────────────────────────────────────────── */}
      <ShowcaseSection />

      {/* ─── Why Brandbite ──────────────────────────────────────────────── */}
      <WhySection />

      {/* ─── FAQ ────────────────────────────────────────────────────────── */}
      <FaqSection />

      {/* ─── Footer ─────────────────────────────────────────────────────── */}
      <SiteFooter />
    </div>
  );
}

// ===========================================================================
// Header
// ===========================================================================

function SiteHeader({ signInHref }: { signInHref: string }) {
  const [mobileOpen, setMobileOpen] = useState(false);

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
            <a
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-[var(--bb-text-secondary)] transition-colors hover:text-[var(--bb-secondary)]"
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
              <a
                key={l.href}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                className="text-sm font-medium text-[var(--bb-text-secondary)]"
              >
                {l.label}
              </a>
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

// ===========================================================================
// Hero + How it works + Bitemark (combined section with organic background)
// ===========================================================================

function HeroBitemarkSection({ signInHref }: { signInHref: string }) {
  return (
    <section className="relative overflow-hidden bg-white">
      {/* Bitemark organic blob — full-section background from Figma SVG */}
      <img
        src="/bitemark.svg"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-0 h-full w-auto max-w-none object-cover object-left-top select-none"
      />

      {/* Hero content */}
      <div className="relative px-6 pt-20 pb-16 text-center sm:pt-28 sm:pb-20">
        <div className="mx-auto max-w-3xl">
          <h1 className="font-brand text-4xl leading-tight font-bold tracking-tight sm:text-5xl md:text-6xl">
            All your creatives, <span className="text-[var(--bb-primary)]">one subscription.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-[var(--bb-text-secondary)] sm:text-lg">
            From landing pages to social media ads — get unlimited creative tasks, delivered fast by
            top-tier creatives.
          </p>
          <div className="mt-8">
            <Link
              href={signInHref}
              className="inline-block rounded-full bg-[var(--bb-primary)] px-8 py-3.5 text-sm font-bold tracking-wide text-white uppercase shadow-[var(--bb-primary)]/25 shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-[var(--bb-primary)]/30 hover:shadow-xl"
            >
              Get Started
            </Link>
          </div>
        </div>
      </div>

      {/* How it works — sits within the bitemark area */}
      <div id="how-it-works" className="relative px-6 pt-8 pb-20 sm:pb-28">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-12 sm:grid-cols-3 sm:gap-8">
          {STEPS.map((step, i) => (
            <div key={i} className="flex flex-col items-center text-center">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--bb-secondary)] text-xl font-bold text-white">
                {i + 1}
              </div>
              <h3 className="mb-2 text-base font-bold text-[var(--bb-secondary)]">{step.title}</h3>
              <p className="max-w-xs text-sm leading-relaxed text-[var(--bb-text-secondary)]">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ===========================================================================
// Pricing
// ===========================================================================

function PricingSection() {
  return (
    <section id="pricing" className="bg-white px-6 py-20 sm:py-24">
      <div className="mx-auto max-w-5xl">
        {/* Heading row */}
        <div className="mb-12 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm text-[var(--bb-text-secondary)]">Start now your</p>
            <h2 className="font-brand text-3xl font-bold tracking-tight sm:text-4xl">
              creative plan
            </h2>
          </div>
          <div className="text-right text-sm">
            <span className="text-[var(--bb-text-secondary)]">Need a custom plan?</span>{" "}
            <a
              href="mailto:hello@brandbite.io"
              className="font-semibold text-[var(--bb-primary)] hover:underline"
            >
              Let&apos;s talk
            </a>
          </div>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {PLANS.map((plan) => (
            <div key={plan.name} className="flex flex-col rounded-3xl bg-[#eae6f1] p-7">
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
                    $ {plan.price.toLocaleString()}
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
                href="#pricing"
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
          ))}
        </div>
      </div>
    </section>
  );
}

// ===========================================================================
// Showcase
// ===========================================================================

function ShowcaseSection() {
  const [works, setWorks] = useState<
    {
      id: string;
      title: string;
      slug: string;
      subtitle: string | null;
      category: string | null;
      thumbnailUrl: string | null;
    }[]
  >([]);

  useEffect(() => {
    fetch("/api/showcase")
      .then((r) => (r.ok ? r.json() : { works: [] }))
      .then((d) => setWorks((d.works ?? []).slice(0, 4)))
      .catch(() => {});
  }, []);

  return (
    <section id="showcase" className="bg-[var(--bb-bg-page)] px-6 py-20 sm:py-24">
      <div className="mx-auto max-w-5xl">
        {/* Heading */}
        <div className="mb-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h2 className="font-brand text-3xl font-bold tracking-tight">Showcase</h2>
            <p className="mt-1 text-sm text-[var(--bb-text-secondary)]">
              Creatives that speak louder than words.
            </p>
          </div>
          <Link
            href="/showcase"
            className="inline-flex items-center gap-1 rounded-full bg-[var(--bb-secondary)] px-5 py-2.5 text-xs font-bold text-white transition-colors hover:bg-[#333]"
          >
            View the full gallery
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {works.map((work) => (
            <Link
              key={work.id}
              href={`/showcase/${work.slug}`}
              className="group relative aspect-[4/3] overflow-hidden rounded-xl bg-[#e8dff5] transition-shadow hover:shadow-lg"
            >
              {work.thumbnailUrl ? (
                <img
                  src={work.thumbnailUrl}
                  alt={work.title}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--bb-border-subtle)]">
                      <svg
                        width="18"
                        height="18"
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
                  </div>
                </div>
              )}
              {/* Overlay with title */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3 pt-8">
                <h3 className="text-sm font-semibold text-white">{work.title}</h3>
                {work.category && (
                  <span className="mt-0.5 block text-[11px] text-white/70">{work.category}</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

// ===========================================================================
// Why Brandbite
// ===========================================================================

function WhySection() {
  return (
    <section className="bg-white px-6 py-20 sm:py-24">
      <div className="mx-auto grid max-w-5xl grid-cols-1 items-center gap-12 lg:grid-cols-2">
        {/* Image placeholder */}
        <div className="aspect-[4/3] overflow-hidden rounded-2xl bg-[#e8dff5]">
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--bb-border-subtle)]">
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
              <span className="text-sm font-medium text-[var(--bb-text-muted)]">Featured work</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div>
          <h2 className="font-brand text-3xl font-bold tracking-tight sm:text-4xl">
            Why Brandbite
          </h2>
          <p className="mt-2 text-sm text-[var(--bb-text-secondary)]">
            Why brands choose Brandbite over freelancers.
          </p>

          <p className="mt-6 mb-4 text-[10px] font-semibold tracking-wider text-[var(--bb-text-muted)] uppercase">
            Plan includes:
          </p>

          <ul className="space-y-3">
            {WHY_ITEMS.map((item, i) => (
              <li key={i} className="flex items-center gap-3 text-sm text-[var(--bb-secondary)]">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="flex-shrink-0"
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
                {item}
              </li>
            ))}
          </ul>

          <div className="mt-8">
            <a
              href="#pricing"
              className="inline-block rounded-full bg-[var(--bb-secondary)] px-7 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#333]"
            >
              Explore Pricing
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

// ===========================================================================
// FAQ (accordion)
// ===========================================================================

function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(1);

  return (
    <section id="faq" className="bg-[var(--bb-bg-page)] px-6 py-20 sm:py-24">
      <div className="mx-auto max-w-2xl">
        <h2 className="font-brand text-3xl font-bold tracking-tight">FAQ</h2>
        <p className="mt-1 mb-10 text-sm text-[var(--bb-text-secondary)]">
          Frequently asked questions.
        </p>

        <div className="space-y-3">
          {FAQS.map((faq, i) => {
            const isOpen = openIndex === i;
            return (
              <div
                key={i}
                className="overflow-hidden rounded-xl border border-[var(--bb-border)] bg-white"
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-semibold text-[var(--bb-secondary)] transition-colors hover:bg-[var(--bb-bg-page)]"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-[var(--bb-primary)]">+</span>
                    {faq.q}
                  </span>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`flex-shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {isOpen && (
                  <div className="border-t border-[var(--bb-border-subtle)] px-5 py-4">
                    <p className="text-sm font-semibold text-[var(--bb-primary)]">{faq.q}</p>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--bb-text-secondary)]">
                      {faq.a}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ===========================================================================
// Footer
// ===========================================================================

function SiteFooter() {
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
