// -----------------------------------------------------------------------------
// @file: components/blocks/BlockRenderer.tsx
// @purpose: Single dispatcher that renders any page block to its
//           type-specific React component. Phase 0 ships HERO; subsequent
//           phases add HOW_IT_WORKS, FEATURE_GRID, FAQ, PRICING, SHOWCASE,
//           and CALL_TO_ACTION as they get migrated off the inline
//           hardcoded sections in `app/page.tsx`.
//
//           Unknown / not-yet-implemented block types render nothing in
//           production (with a dev-only console warning). That keeps the
//           page healthy while we migrate sections one at a time.
// -----------------------------------------------------------------------------

import type { PageBlock } from "@/lib/blocks/get-page-blocks";
import { BLOCK_TYPES } from "@/lib/blocks/types";

import { CallToActionBlock } from "./CallToActionBlock";
import { FaqBlock } from "./FaqBlock";
import { FeatureGridBlock } from "./FeatureGridBlock";
import { HeroBlock } from "./HeroBlock";
import { HowItWorksBlock } from "./HowItWorksBlock";
import { PricingHeaderBlock } from "./PricingHeaderBlock";
import { ShowcaseHeaderBlock } from "./ShowcaseHeaderBlock";

type BlockRendererProps = {
  block: PageBlock;
  /** Optional contextual data passed to blocks that need it (currently
   *  just HERO for sign-in href fallback). */
  signInHref?: string;
};

export function BlockRenderer({ block, signInHref = "/login" }: BlockRendererProps) {
  switch (block.type) {
    case BLOCK_TYPES.HERO:
      return <HeroBlock data={block.data} signInHref={signInHref} />;

    case BLOCK_TYPES.HOW_IT_WORKS:
      return <HowItWorksBlock data={block.data} />;

    case BLOCK_TYPES.FAQ:
      return <FaqBlock data={block.data} />;

    case BLOCK_TYPES.FEATURE_GRID:
      return <FeatureGridBlock data={block.data} />;

    case BLOCK_TYPES.PRICING:
      // The pricing block only owns the section header band — the plan
      // grid lives in app/page.tsx PricingSection where it joins the
      // header to the live /api/plans data. BlockRenderer can still
      // render the header standalone (used by /admin/landing's preview
      // and any future page that wants just the header).
      return <PricingHeaderBlock data={block.data} />;

    case BLOCK_TYPES.SHOWCASE:
      // Same split as PRICING — the gallery items come from /api/showcase
      // (managed via /admin/showcase), so this block only owns the
      // framing band above the grid.
      return <ShowcaseHeaderBlock data={block.data} />;

    case BLOCK_TYPES.CALL_TO_ACTION:
      return <CallToActionBlock data={block.data} />;

    default: {
      // exhaustive-ish: block.type is narrowed to never via the union, so
      // hitting the default means the registry got out of sync.
      const _exhaustive: never = block;
      return null;
      void _exhaustive;
    }
  }
}
