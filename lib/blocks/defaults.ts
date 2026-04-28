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

import type { HeroData, HowItWorksData } from "./types";

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
