// -----------------------------------------------------------------------------
// @file: app/admin/landing/page.tsx
// @purpose: LEGACY editor for the page-block landing layout (pageKey
//           "home"): Hero, How it works, Pricing header, Showcase header,
//           Why Brandbite (FEATURE_GRID), Call to action and FAQ. A section
//           selector shows one block form at a time (all stay mounted).
//
//           NOTE: the live homepage (app/page.tsx) is static since the 2026
//           redesign and nothing renders these blocks any more; the page
//           says so in a warning callout.
//
//           Server component: loads the existing hero block via the
//           server-only `getPageBlocks` helper so the form can hydrate
//           with the persisted values. If no row exists yet, falls back
//           to `DEFAULT_HERO_DATA` (the currently-shipped copy) so first
//           save is just "edit + save" rather than "type from scratch".
// -----------------------------------------------------------------------------
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-04-28
// -----------------------------------------------------------------------------

import { OwnerOnlyBanner } from "@/components/admin/owner-only-banner";
import { Badge, Callout, PageHeader, TextLink } from "@/components/admin/v2/ui";
import {
  Code,
  SectionSwitcher,
  type SwitcherSection,
} from "@/components/blocks/admin/block-form-ui";
import { CallToActionBlockForm } from "@/components/blocks/admin/CallToActionBlockForm";
import { FaqBlockForm } from "@/components/blocks/admin/FaqBlockForm";
import { FeatureGridBlockForm } from "@/components/blocks/admin/FeatureGridBlockForm";
import { HeroBlockForm } from "@/components/blocks/admin/HeroBlockForm";
import { HowItWorksBlockForm } from "@/components/blocks/admin/HowItWorksBlockForm";
import { PricingHeaderBlockForm } from "@/components/blocks/admin/PricingHeaderBlockForm";
import { ShowcaseHeaderBlockForm } from "@/components/blocks/admin/ShowcaseHeaderBlockForm";

import { getPageBlocks } from "@/lib/blocks/get-page-blocks";
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
  type CallToActionData,
  type FaqData,
  type FeatureGridData,
  type HeroData,
  type HowItWorksData,
  type PricingData,
  type ShowcaseData,
} from "@/lib/blocks/types";

const PAGE_KEY = "home";

export default async function AdminLandingPage() {
  // Read existing blocks for the home page. If a row exists for a given
  // type we hydrate that form with it; otherwise we fall back to the
  // shipped-in-code defaults so the admin doesn't have to retype.
  const blocks = await getPageBlocks(PAGE_KEY);

  const heroBlock = blocks.find((b) => b.type === BLOCK_TYPES.HERO);
  const initialHero: HeroData =
    heroBlock && heroBlock.type === BLOCK_TYPES.HERO ? heroBlock.data : DEFAULT_HERO_DATA;

  const howItWorksBlock = blocks.find((b) => b.type === BLOCK_TYPES.HOW_IT_WORKS);
  const initialHowItWorks: HowItWorksData =
    howItWorksBlock && howItWorksBlock.type === BLOCK_TYPES.HOW_IT_WORKS
      ? howItWorksBlock.data
      : DEFAULT_HOW_IT_WORKS_DATA;

  const featureGridBlock = blocks.find((b) => b.type === BLOCK_TYPES.FEATURE_GRID);
  const initialFeatureGrid: FeatureGridData =
    featureGridBlock && featureGridBlock.type === BLOCK_TYPES.FEATURE_GRID
      ? featureGridBlock.data
      : DEFAULT_FEATURE_GRID_DATA;

  const pricingBlock = blocks.find((b) => b.type === BLOCK_TYPES.PRICING);
  const initialPricing: PricingData =
    pricingBlock && pricingBlock.type === BLOCK_TYPES.PRICING
      ? pricingBlock.data
      : DEFAULT_PRICING_DATA;

  const showcaseBlock = blocks.find((b) => b.type === BLOCK_TYPES.SHOWCASE);
  const initialShowcase: ShowcaseData =
    showcaseBlock && showcaseBlock.type === BLOCK_TYPES.SHOWCASE
      ? showcaseBlock.data
      : DEFAULT_SHOWCASE_DATA;

  const ctaBlock = blocks.find((b) => b.type === BLOCK_TYPES.CALL_TO_ACTION);
  const initialCta: CallToActionData =
    ctaBlock && ctaBlock.type === BLOCK_TYPES.CALL_TO_ACTION
      ? ctaBlock.data
      : DEFAULT_CALL_TO_ACTION_DATA;

  const faqBlock = blocks.find((b) => b.type === BLOCK_TYPES.FAQ);
  const initialFaq: FaqData =
    faqBlock && faqBlock.type === BLOCK_TYPES.FAQ ? faqBlock.data : DEFAULT_FAQ_DATA;

  const sections: SwitcherSection[] = [
    {
      id: "hero",
      label: "Hero",
      icon: <IconLines />,
      description:
        "The above-the-fold area. Pick a layout variant, then fill in the headline, subhead and call-to-action. Image-based variants need a hero photo.",
      content: <HeroBlockForm initial={initialHero} pageKey={PAGE_KEY} />,
    },
    {
      id: "how-it-works",
      label: "How it works",
      icon: <IconList />,
      description:
        "The numbered steps section under the hero. 1 to 5 steps, plus an optional eyebrow and section title above the grid.",
      content: <HowItWorksBlockForm initial={initialHowItWorks} pageKey={PAGE_KEY} />,
    },
    {
      id: "pricing",
      label: "Pricing header",
      icon: <IconDollar />,
      description:
        "The eyebrow and title above the plan cards, plus the optional right-side “Need a custom plan? Let’s talk” prompt.",
      content: <PricingHeaderBlockForm initial={initialPricing} pageKey={PAGE_KEY} />,
    },
    {
      id: "showcase",
      label: "Showcase header",
      icon: <IconGrid />,
      description:
        "The title and subtitle above the gallery grid, plus the right-side “View the full gallery” button.",
      content: <ShowcaseHeaderBlockForm initial={initialShowcase} pageKey={PAGE_KEY} />,
    },
    {
      id: "why-brandbite",
      label: "Why brandbite",
      icon: <IconStar />,
      description:
        "The feature grid: 1 to 12 benefits, each with an optional emoji and body. Add a side image for a 2-column layout.",
      content: <FeatureGridBlockForm initial={initialFeatureGrid} pageKey={PAGE_KEY} />,
    },
    {
      id: "cta",
      label: "Call to action",
      icon: <IconPointer />,
      description:
        "Full-width conversion band between Why brandbite and the FAQ: headline, optional subhead and a primary button.",
      content: <CallToActionBlockForm initial={initialCta} pageKey={PAGE_KEY} />,
    },
    {
      id: "faq",
      label: "FAQ",
      icon: <IconHelp />,
      description:
        "The question/answer accordion near the bottom. Pick up to 40 questions from the central FAQ list and set their order.",
      content: <FaqBlockForm initial={initialFaq} pageKey={PAGE_KEY} />,
    },
  ];

  return (
    <>
      <PageHeader
        title={
          <span className="inline-flex flex-wrap items-center gap-3">
            Landing page
            <Badge tone="neutral" className="tracking-normal">
              Legacy editor
            </Badge>
          </span>
        }
        description="Edit the saved legacy landing-page layout one section at a time."
      />

      <OwnerOnlyBanner action="edit landing-page content" />

      <div className="mb-6">
        <Callout tone="warning" title="Not connected to the live homepage">
          The public homepage (<Code>/</Code>) is a static page and doesn&apos;t read these blocks,
          and no other page renders them either. Saving here stores the content but changes nothing
          visitors see.
        </Callout>
      </div>

      <SectionSwitcher
        label="Landing page sections"
        sections={sections}
        footer={
          <>
            <p className="font-semibold text-[var(--av2-text)]">Edited elsewhere</p>
            <ul className="mt-2 space-y-1.5">
              <li>
                <TextLink href="/admin/plans">Plan cards</TextLink>
              </li>
              <li>
                <TextLink href="/admin/showcase">Showcase items</TextLink>
              </li>
              <li>
                <TextLink href="/admin/faq">FAQ questions</TextLink>
              </li>
              <li>
                <TextLink href="/admin/site">Site header &amp; footer</TextLink>
              </li>
            </ul>
          </>
        }
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Section icons (page-local, same 24px / 1.75 stroke family as the v2 set)
// ---------------------------------------------------------------------------

const ICON = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function IconLines() {
  return (
    <svg {...ICON}>
      <path d="M4 6h16M4 12h16M4 18h10" />
    </svg>
  );
}
function IconList() {
  return (
    <svg {...ICON}>
      <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />
    </svg>
  );
}
function IconDollar() {
  return (
    <svg {...ICON}>
      <circle cx="12" cy="12" r="9" />
      <path d="M15 9.5c-.4-1-1.6-1.5-3-1.5-1.7 0-3 .8-3 2s1.3 1.7 3 2 3 .8 3 2-1.3 2-3 2c-1.4 0-2.6-.5-3-1.5M12 6.5v11" />
    </svg>
  );
}
function IconGrid() {
  return (
    <svg {...ICON}>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
    </svg>
  );
}
function IconStar() {
  return (
    <svg {...ICON}>
      <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
    </svg>
  );
}
function IconPointer() {
  return (
    <svg {...ICON}>
      <path d="M6 3.5 18.5 12l-5.6 1.3 3.2 6-2.4 1.2-3.2-6L6 18.5z" />
    </svg>
  );
}
function IconHelp() {
  return (
    <svg {...ICON}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01" />
    </svg>
  );
}
