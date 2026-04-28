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

import type { FaqData, HeroData, HowItWorksData } from "./types";

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

/** Default FAQ block matching the currently-shipped landing-page FAQ.
 *  Same four Q&As that have been showing on the public site since the
 *  marketing page launched, in the same order. */
export const DEFAULT_FAQ_DATA: FaqData = {
  qas: [
    {
      q: "How fast will I get my creatives?",
      a: "Most requests are completed within 1 to 2 days. Larger projects like brand identity guides or motion videos may take 3 to 5 business days depending on complexity.",
    },
    {
      q: "Can I cancel anytime?",
      a: "Yes. You can pause or cancel your subscription at any time. No long-term contracts, no cancellation fees. Your work and assets remain yours.",
    },
    {
      q: "What if I don't like the creative?",
      a: "No worries! Every plan includes unlimited revisions. We'll keep iterating until you're 100% happy with the result.",
    },
    {
      q: "Do you work with agencies?",
      a: "Absolutely. Many agencies use Brandbite as their white-label creative arm. We offer agency-friendly plans with multi-seat access and dedicated account managers.",
    },
  ],
};
