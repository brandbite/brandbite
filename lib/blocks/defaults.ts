// -----------------------------------------------------------------------------
// @file: lib/blocks/defaults.ts
// @purpose: Default block payloads for the admin editor's "first save"
//           experience. When an admin opens the landing-page editor and no
//           PageBlock row exists yet for a section, the form prefills with
//           the data here so they don't have to retype the existing
//           hardcoded copy. After their first save the DB row takes
//           precedence.
//
//           Keeping the defaults colocated with the block-type definitions
//           makes onboarding the editor a no-op operation: existing users
//           see exactly what's currently shipped, then edit from there.
// -----------------------------------------------------------------------------

import type {
  CallToActionData,
  FaqData,
  FeatureGridData,
  HeroData,
  HowItWorksData,
  PricingData,
  ShowcaseData,
  SiteFooterData,
  SiteHeaderData,
} from "./types";

/** Default hero block matching the currently-shipped landing-page hero. */
export const DEFAULT_HERO_DATA: HeroData = {
  variant: "centered",
  headline: "All your creatives, one subscription.",
  subhead:
    "From landing pages to social media ads. Get unlimited creative tasks, delivered fast by top-tier creatives.",
  ctaLabel: "Get Started",
  ctaHref: "/login",
};

/** Default "how it works" block matching the currently-shipped landing-page
 *  three-step section under the hero. Same copy that's been shipping in
 *  `app/page.tsx` since the marketing page launched. */
export const DEFAULT_HOW_IT_WORKS_DATA: HowItWorksData = {
  steps: [
    {
      title: "Submit a creative request",
      description: "Tell us what you need. Logo, landing page, or ad visuals.",
    },
    {
      title: "Get matched instantly",
      description: "Your personal creative starts working within 24 hours.",
    },
    {
      title: "Review & revise endlessly",
      description: "Request changes until it's perfect. No limits.",
    },
  ],
};

/**
 * Default FAQ block. PR C made the block a *picker* over the central
 * Faq table — the inline `qas` shape from PR #190 is gone.
 *
 * Empty `selectedFaqIds` means "no FAQs picked yet"; the renderer falls
 * back to showing the first N active FAQs from the central store. So a
 * site with no FAQ block row + no selection still shows a sensible FAQ
 * section out of the box, while pickers on /admin/landing start from a
 * blank slate that the admin curates.
 *
 * Default cap for the empty-state fallback. Tuned to match the previous
 * shipped 4-question section on the landing page. The renderer reads
 * this and slices the central FAQ list accordingly when no IDs are
 * picked.
 */
export const DEFAULT_FAQ_FALLBACK_LIMIT = 5;

export const DEFAULT_FAQ_DATA: FaqData = {
  selectedFaqIds: [],
  // Out-of-the-box "See all questions" CTA pointing at the full FAQ
  // index. The landing page only surfaces a curated subset — visitors
  // who reach the bottom of the section deserve a clear path to the
  // rest. Admins can clear both fields in the picker form to hide the
  // CTA entirely.
  ctaLabel: "See all questions",
  ctaHref: "/faq",
};

/** Default pricing block matching the currently-shipped landing-page
 *  pricing-section header. Per-plan content (tagline, features,
 *  CTA-label) lives on the Plan model — this block only frames the
 *  section above the plan-card grid. */
export const DEFAULT_PRICING_DATA: PricingData = {
  eyebrow: "Start now your",
  title: "creative plan",
  contactNote: "Need a custom plan?",
  contactLabel: "Let's talk",
  contactHref: "mailto:hello@brandbite.io",
};

/**
 * Default call-to-action block. Unlike the other defaults, this one
 * isn't a back-fill of pre-existing copy — there was no CTA band on
 * the landing page before this block existed. The defaults are a
 * sensible "first conversion moment" prompt admins can override.
 *
 * The renderer styles the section as a cream-background band (matching
 * the "Still have questions?" pattern on /faq) so it's visually
 * distinct from the white-bg sections around it without overwhelming
 * the page with brand-primary.
 */
export const DEFAULT_CALL_TO_ACTION_DATA: CallToActionData = {
  headline: "Ready to start your first creative request?",
  subhead: "Pause or cancel anytime. Your work and assets stay yours.",
  ctaLabel: "Get Started",
  ctaHref: "/login",
};

/** Default showcase header block matching the currently-shipped
 *  landing-page section. Items themselves come from /api/showcase
 *  (managed via /admin/showcase) — this block only owns the framing
 *  band above the gallery grid. */
export const DEFAULT_SHOWCASE_DATA: ShowcaseData = {
  title: "Showcase",
  subtitle: "Creatives that speak louder than words.",
  ctaLabel: "View the full gallery",
  ctaHref: "/showcase",
};

/** Default feature grid block matching the currently-shipped landing-page
 *  "Why Brandbite" section. Same five reasons that have been visible on
 *  the public site since launch, with the same "Explore Pricing" CTA
 *  pointing back at the pricing anchor on the same page. */
export const DEFAULT_FEATURE_GRID_DATA: FeatureGridData = {
  title: "Why Brandbite",
  subtitle: "Why brands choose Brandbite over freelancers.",
  items: [
    { title: "Fast turnaround (1 to 2 days per request)" },
    { title: "Direct Slack communication" },
    { title: "Brand guidelines" },
    { title: "Flexible subscription. Pause anytime." },
    { title: "Access to top European talent" },
  ],
  ctaLabel: "Explore Pricing",
  ctaHref: "#pricing",
};

/** Default site header — the nav-link list previously hardcoded in
 *  components/marketing/site-header.tsx (NAV_LINKS). Renders on every
 *  marketing page when no DB row is set. */
export const DEFAULT_SITE_HEADER_DATA: SiteHeaderData = {
  navLinks: [
    { label: "How it works?", href: "/how-it-works" },
    { label: "Pricing", href: "/pricing" },
    { label: "Showcase", href: "/showcase" },
    { label: "FAQs", href: "/faq" },
    { label: "Blog", href: "/blog" },
  ],
};

/** Default site footer — brand statement, link columns, and legal-link
 *  bar previously hardcoded in components/marketing/site-footer.tsx
 *  (FOOTER_COLS + BOTTOM_LEGAL_LINKS). The "Get the app" column from
 *  the original footer was a placeholder (links pointed to `#`) and is
 *  intentionally not seeded — admins can re-add it via the form once
 *  there are real download URLs. */
export const DEFAULT_SITE_FOOTER_DATA: SiteFooterData = {
  brandStatement: "All your creatives, one subscription",
  columns: [
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
  ],
  legalLinks: [
    { label: "Terms of Service", href: "/terms" },
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Cookies", href: "/cookies" },
    { label: "Accessibility", href: "/accessibility" },
  ],
};
