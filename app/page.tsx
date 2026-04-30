// -----------------------------------------------------------------------------
// @file: app/page.tsx
// @purpose: Marketing landing page — Figma-based, creative-as-a-service
// -----------------------------------------------------------------------------

"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { CallToActionBlock } from "@/components/blocks/CallToActionBlock";
import { FaqBlock } from "@/components/blocks/FaqBlock";
import { FeatureGridBlock } from "@/components/blocks/FeatureGridBlock";
import { HeroBlock } from "@/components/blocks/HeroBlock";
import { HowItWorksBlock } from "@/components/blocks/HowItWorksBlock";
import { PricingHeaderBlock } from "@/components/blocks/PricingHeaderBlock";
import { ShowcaseHeaderBlock } from "@/components/blocks/ShowcaseHeaderBlock";
import { SiteHeader } from "@/components/marketing/site-header";

import {
  DEFAULT_CALL_TO_ACTION_DATA,
  DEFAULT_FAQ_DATA,
  DEFAULT_FEATURE_GRID_DATA,
  DEFAULT_HERO_DATA,
  DEFAULT_HOW_IT_WORKS_DATA,
  DEFAULT_PRICING_DATA,
  DEFAULT_SHOWCASE_DATA,
} from "@/lib/blocks/defaults";
import {
  BLOCK_TYPES,
  parseBlockData,
  type CallToActionData,
  type FaqData,
  type FeatureGridData,
  type HeroData,
  type HowItWorksData,
  type PricingData,
  type ShowcaseData,
} from "@/lib/blocks/types";

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

/**
 * Static display copy keyed by plan `name`. The price itself is read
 * from the DB at render time (Stripe-authoritative), but the tagline,
 * feature bullets, CTA label, and tip line stay hardcoded here \u2014 they
 * don't change with Stripe and putting them in a CMS adds complexity
 * we don't need yet. If a new plan name lands in the DB without a
 * matching entry here, it renders with the FALLBACK_DISPLAY values.
 */
type PlanDisplay = {
  tagline: string;
  features: string[];
  cta: string;
  subtitle: string;
};

const PLAN_DISPLAY: Record<string, PlanDisplay> = {
  Starter: {
    tagline: "Best for startups and solo founders",
    features: [
      "1 active creative request at a time",
      "Unlimited revisions & brand asset storage",
      "Delivery in 2 to 3 business days per task",
    ],
    cta: "GET STARTED",
    subtitle: "\u201cPause or cancel anytime.\u201d",
  },
  Brand: {
    tagline: "Perfect for marketing teams & growing brands",
    features: [
      "2 active creative requests simultaneously",
      "Priority turnaround (1 to 2 business days)",
      "Slack workspace access for real-time collaboration",
    ],
    cta: "CHOOSE BRAND",
    subtitle: "\u201cMost popular choice for performance teams.\u201d",
  },
  Full: {
    tagline: "For agencies and fast-moving creative teams",
    features: [
      "Unlimited active requests & team seats",
      "Dedicated project manager & creative lead",
      "Custom brand portal + asset library integration",
    ],
    cta: "GO WITH FULL",
    subtitle: "\u201cBest value for high-volume creative production.\u201d",
  },
};

const FALLBACK_DISPLAY: PlanDisplay = {
  tagline: "Custom subscription",
  features: [],
  cta: "GET STARTED",
  subtitle: "",
};

/**
 * Static fallback used only when /api/plans is unreachable or returns
 * an error. Production should always hit the DB-driven path; this
 * exists so the page never renders empty pricing if the API hiccups.
 */
const FALLBACK_PLANS: { name: string; priceCents: number }[] = [
  { name: "Starter", priceCents: 49500 },
  { name: "Brand", priceCents: 99500 },
  { name: "Full", priceCents: 189500 },
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
      <SiteHeader />

      {/* ─── Hero (DB-driven via PageBlock; falls back to defaults) ─────── */}
      <HeroSection signInHref={signInHref} />

      {/* ─── How it works ───────────────────────────────────────────────── */}
      <HowItWorksSection />

      {/* ─── Pricing ────────────────────────────────────────────────────── */}
      <PricingSection />

      {/* ─── Showcase ───────────────────────────────────────────────────── */}
      <ShowcaseSection />

      {/* ─── Why Brandbite ──────────────────────────────────────────────── */}
      <WhySection />

      {/* ─── Call-to-action band (DB-driven; falls back to defaults) ────── */}
      <CallToActionSection />

      {/* ─── FAQ ────────────────────────────────────────────────────────── */}
      <FaqSection />

      {/* ─── Footer ─────────────────────────────────────────────────────── */}
      <SiteFooter />
    </div>
  );
}

// ===========================================================================
// PageBlock-driven sections
//
// Phase 1+ of the in-house page editor: each editable section reads its
// data from /api/page-blocks/home and renders via the matching block
// component. Initial render uses the defaults so the first paint matches
// the historical hardcoded look; the API fetch only swaps in the
// admin-customised content once it lands.
//
// Each section is intentionally a separate small component with its own
// useEffect fetch. The endpoint is edge-cached (60s + SWR) so the
// duplicate requests dedupe at the CDN, and keeping them per-section
// makes adding new editable sections a copy-paste of the same shape.
// ===========================================================================

type AnyBlockApiPayload = { type?: string; data?: unknown };

function HeroSection({ signInHref }: { signInHref: string }) {
  const [heroData, setHeroData] = useState<HeroData>(DEFAULT_HERO_DATA);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/page-blocks/home")
      .then((res) => {
        if (!res.ok) throw new Error(`/api/page-blocks/home returned ${res.status}`);
        return res.json();
      })
      .then((json: { blocks?: AnyBlockApiPayload[] }) => {
        if (cancelled) return;
        const heroRow = json.blocks?.find((b) => b?.type === BLOCK_TYPES.HERO);
        if (!heroRow) return; // keep defaults
        // Re-validate client-side. Server already validated on save, but
        // shape-checking again keeps a bad row from blowing up the page
        // (e.g. if the schema tightens after the row was written).
        const parsed = parseBlockData({ type: BLOCK_TYPES.HERO, data: heroRow.data });
        if (parsed && parsed.type === BLOCK_TYPES.HERO) {
          setHeroData(parsed.data);
        }
      })
      .catch(() => {
        // Silent fallback to defaults on network / parse error. The page
        // already shows the default hero so there's nothing user-facing
        // to do here.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return <HeroBlock data={heroData} signInHref={signInHref} />;
}

function HowItWorksSection() {
  const [data, setData] = useState<HowItWorksData>(DEFAULT_HOW_IT_WORKS_DATA);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/page-blocks/home")
      .then((res) => {
        if (!res.ok) throw new Error(`/api/page-blocks/home returned ${res.status}`);
        return res.json();
      })
      .then((json: { blocks?: AnyBlockApiPayload[] }) => {
        if (cancelled) return;
        const row = json.blocks?.find((b) => b?.type === BLOCK_TYPES.HOW_IT_WORKS);
        if (!row) return;
        const parsed = parseBlockData({ type: BLOCK_TYPES.HOW_IT_WORKS, data: row.data });
        if (parsed && parsed.type === BLOCK_TYPES.HOW_IT_WORKS) {
          setData(parsed.data);
        }
      })
      .catch(() => {
        // Silent fallback to defaults.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return <HowItWorksBlock data={data} />;
}

// ===========================================================================
// Pricing
// ===========================================================================

type ApiPlan = {
  id: string;
  name: string;
  priceCents: number;
  monthlyTokens: number;
  /** Public display copy, surfaced from /api/plans (which reads the
   *  Plan-row columns added in the pricing PR 2 migration). All
   *  optional — when null, the renderer falls back to the static
   *  PLAN_DISPLAY map below (for legacy plans pre-migration), then
   *  to FALLBACK_DISPLAY (for unknown plan names entirely). */
  tagline?: string | null;
  features?: string[] | null;
  displayCtaLabel?: string | null;
  displaySubtitle?: string | null;
};

function PricingSection() {
  // DB-driven prices — fetched at mount via /api/plans, falls back to a
  // safe constant if the API is unreachable so the page never renders
  // with empty cards. The DB row's `priceCents` is itself kept in sync
  // with Stripe via the webhook handler in /api/billing/webhook.
  const [plans, setPlans] = useState<ApiPlan[] | null>(null);
  const [didError, setDidError] = useState(false);

  // Section header copy — separately fetched from /api/page-blocks/home.
  // Prices and per-plan content stay on /api/plans + the Plan model;
  // the PRICING block only owns the header band above the grid.
  const [headerData, setHeaderData] = useState<PricingData>(DEFAULT_PRICING_DATA);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/plans")
      .then((res) => {
        if (!res.ok) throw new Error(`/api/plans returned ${res.status}`);
        return res.json();
      })
      .then((json: { plans?: ApiPlan[] }) => {
        if (cancelled) return;
        setPlans(Array.isArray(json.plans) ? json.plans : []);
      })
      .catch(() => {
        if (cancelled) return;
        setDidError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/page-blocks/home")
      .then((res) => {
        if (!res.ok) throw new Error(`/api/page-blocks/home returned ${res.status}`);
        return res.json();
      })
      .then((json: { blocks?: AnyBlockApiPayload[] }) => {
        if (cancelled) return;
        const row = json.blocks?.find((b) => b?.type === BLOCK_TYPES.PRICING);
        if (!row) return;
        const parsed = parseBlockData({ type: BLOCK_TYPES.PRICING, data: row.data });
        if (parsed && parsed.type === BLOCK_TYPES.PRICING) {
          setHeaderData(parsed.data);
        }
      })
      .catch(() => {
        // Silent fallback to defaults.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Resolve which list to render: API result if present; static fallback
  // if API errored; null while still loading (renders skeleton placeholders).
  const list: ApiPlan[] | null =
    plans ??
    (didError
      ? FALLBACK_PLANS.map((p, i) => ({
          id: `fallback-${i}`,
          name: p.name,
          priceCents: p.priceCents,
          monthlyTokens: 0,
        }))
      : null);

  return (
    <section id="pricing" className="bg-white px-6 py-20 sm:py-24">
      <div className="mx-auto max-w-5xl">
        <PricingHeaderBlock data={headerData} />

        {/* Cards */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {list === null
            ? // Loading skeletons — three muted cards while /api/plans is in flight.
              Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={`skeleton-${i}`}
                  className="h-[360px] animate-pulse rounded-3xl bg-[#eae6f1]"
                />
              ))
            : list.map((plan) => {
                // Per-field cascade: DB-driven plan column wins; falls
                // back to the named static map (covers legacy rows that
                // pre-date the migration), then to a generic fallback.
                const staticDisplay = PLAN_DISPLAY[plan.name] ?? FALLBACK_DISPLAY;
                const display = {
                  tagline: plan.tagline ?? staticDisplay.tagline,
                  features:
                    plan.features && plan.features.length > 0
                      ? plan.features
                      : staticDisplay.features,
                  cta: plan.displayCtaLabel ?? staticDisplay.cta,
                  subtitle: plan.displaySubtitle ?? staticDisplay.subtitle,
                };
                const price = Math.round(plan.priceCents / 100);
                return (
                  <div key={plan.id} className="flex flex-col rounded-3xl bg-[#eae6f1] p-7">
                    {/* Name + price */}
                    <div className="mb-2 flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-bold text-[var(--bb-secondary)]">
                          {plan.name}
                        </h3>
                        <p className="mt-0.5 text-xs leading-snug text-[var(--bb-text-secondary)]">
                          {display.tagline}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-extrabold text-[var(--bb-secondary)]">
                          $ {price.toLocaleString()}
                        </span>
                        <span className="block text-[10px] text-[var(--bb-text-muted)]">
                          per month
                        </span>
                      </div>
                    </div>

                    {/* Separator dash */}
                    <div className="mb-6 h-0.5 w-6 bg-[var(--bb-secondary)]" />

                    {/* Features */}
                    <p className="mb-3 text-[11px] font-bold text-[var(--bb-secondary)]">
                      Plan includes :
                    </p>
                    <ul className="mb-6 flex-1 space-y-2.5">
                      {display.features.map((f) => (
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
                      {display.cta}
                    </Link>

                    {/* Subtitle */}
                    {display.subtitle && (
                      <p className="mt-3 text-center text-[10px] leading-snug text-[var(--bb-text-muted)] italic">
                        {display.subtitle}
                      </p>
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

  // Header copy — separately fetched from /api/page-blocks/home. Items
  // continue to come from /api/showcase (Showcase table, managed via
  // /admin/showcase). The block only owns the framing band above.
  const [headerData, setHeaderData] = useState<ShowcaseData>(DEFAULT_SHOWCASE_DATA);

  useEffect(() => {
    fetch("/api/showcase")
      .then((r) => (r.ok ? r.json() : { works: [] }))
      .then((d) => setWorks((d.works ?? []).slice(0, 4)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/page-blocks/home")
      .then((res) => {
        if (!res.ok) throw new Error(`/api/page-blocks/home returned ${res.status}`);
        return res.json();
      })
      .then((json: { blocks?: AnyBlockApiPayload[] }) => {
        if (cancelled) return;
        const row = json.blocks?.find((b) => b?.type === BLOCK_TYPES.SHOWCASE);
        if (!row) return;
        const parsed = parseBlockData({ type: BLOCK_TYPES.SHOWCASE, data: row.data });
        if (parsed && parsed.type === BLOCK_TYPES.SHOWCASE) {
          setHeaderData(parsed.data);
        }
      })
      .catch(() => {
        // Silent fallback to defaults.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section id="showcase" className="bg-[var(--bb-bg-page)] px-6 py-20 sm:py-24">
      <div className="mx-auto max-w-5xl">
        <ShowcaseHeaderBlock data={headerData} />

        {/* Grid */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {works.map((work) => (
            <Link
              key={work.id}
              href={`/showcase/${work.slug}`}
              className="group relative aspect-[4/3] overflow-hidden rounded-xl bg-[#e8dff5] transition-shadow hover:shadow-lg"
            >
              {work.thumbnailUrl ? (
                <Image
                  src={work.thumbnailUrl}
                  alt={work.title}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
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
// Why Brandbite — DB-driven FEATURE_GRID block with fallback to defaults
// ===========================================================================

function WhySection() {
  const [data, setData] = useState<FeatureGridData>(DEFAULT_FEATURE_GRID_DATA);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/page-blocks/home")
      .then((res) => {
        if (!res.ok) throw new Error(`/api/page-blocks/home returned ${res.status}`);
        return res.json();
      })
      .then((json: { blocks?: AnyBlockApiPayload[] }) => {
        if (cancelled) return;
        const row = json.blocks?.find((b) => b?.type === BLOCK_TYPES.FEATURE_GRID);
        if (!row) return;
        const parsed = parseBlockData({ type: BLOCK_TYPES.FEATURE_GRID, data: row.data });
        if (parsed && parsed.type === BLOCK_TYPES.FEATURE_GRID) {
          setData(parsed.data);
        }
      })
      .catch(() => {
        // Silent fallback to defaults.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return <FeatureGridBlock data={data} />;
}

// ===========================================================================
// Call-to-action band — DB-driven via PageBlock with fallback to defaults
// ===========================================================================

function CallToActionSection() {
  const [data, setData] = useState<CallToActionData>(DEFAULT_CALL_TO_ACTION_DATA);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/page-blocks/home")
      .then((res) => {
        if (!res.ok) throw new Error(`/api/page-blocks/home returned ${res.status}`);
        return res.json();
      })
      .then((json: { blocks?: AnyBlockApiPayload[] }) => {
        if (cancelled) return;
        const row = json.blocks?.find((b) => b?.type === BLOCK_TYPES.CALL_TO_ACTION);
        if (!row) return;
        const parsed = parseBlockData({ type: BLOCK_TYPES.CALL_TO_ACTION, data: row.data });
        if (parsed && parsed.type === BLOCK_TYPES.CALL_TO_ACTION) {
          setData(parsed.data);
        }
      })
      .catch(() => {
        // Silent fallback to defaults.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return <CallToActionBlock data={data} />;
}

// ===========================================================================
// FAQ (accordion) — DB-driven via PageBlock with fallback to defaults
// ===========================================================================

function FaqSection() {
  const [data, setData] = useState<FaqData>(DEFAULT_FAQ_DATA);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/page-blocks/home")
      .then((res) => {
        if (!res.ok) throw new Error(`/api/page-blocks/home returned ${res.status}`);
        return res.json();
      })
      .then((json: { blocks?: AnyBlockApiPayload[] }) => {
        if (cancelled) return;
        const row = json.blocks?.find((b) => b?.type === BLOCK_TYPES.FAQ);
        if (!row) return;
        const parsed = parseBlockData({ type: BLOCK_TYPES.FAQ, data: row.data });
        if (parsed && parsed.type === BLOCK_TYPES.FAQ) {
          setData(parsed.data);
        }
      })
      .catch(() => {
        // Silent fallback to defaults.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return <FaqBlock data={data} />;
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
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-gray-300 transition-colors hover:text-white"
                    >
                      {link.label}
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
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/80">
            <Link href="/terms" className="hover:text-white">
              Terms of Service
            </Link>
            <Link href="/privacy" className="hover:text-white">
              Privacy Policy
            </Link>
            <Link href="/cookies" className="hover:text-white">
              Cookies
            </Link>
            <Link href="/accessibility" className="hover:text-white">
              Accessibility
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
