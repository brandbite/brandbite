// -----------------------------------------------------------------------------
// @file: app/admin/landing/page.tsx
// @purpose: Admin route for editing the public landing page (`/`) section
//           by section. Phase 1 ships the HERO editor only — variant +
//           headline + subhead + CTA pair + optional image. Subsequent
//           phases add forms for HOW_IT_WORKS, PRICING, SHOWCASE,
//           FEATURE_GRID, FAQ, and CALL_TO_ACTION.
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
import { FaqBlockForm } from "@/components/blocks/admin/FaqBlockForm";
import { HeroBlockForm } from "@/components/blocks/admin/HeroBlockForm";
import { HowItWorksBlockForm } from "@/components/blocks/admin/HowItWorksBlockForm";

import { getPageBlocks } from "@/lib/blocks/get-page-blocks";
import {
  DEFAULT_FAQ_DATA,
  DEFAULT_HERO_DATA,
  DEFAULT_HOW_IT_WORKS_DATA,
} from "@/lib/blocks/defaults";
import { BLOCK_TYPES, type FaqData, type HeroData, type HowItWorksData } from "@/lib/blocks/types";

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

  const faqBlock = blocks.find((b) => b.type === BLOCK_TYPES.FAQ);
  const initialFaq: FaqData =
    faqBlock && faqBlock.type === BLOCK_TYPES.FAQ ? faqBlock.data : DEFAULT_FAQ_DATA;

  return (
    <>
      {/* Page header */}
      <div className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Landing page</h1>
        <p className="mt-1 text-sm text-[var(--bb-text-secondary)]">
          Edit the public landing page section by section. Changes apply to{" "}
          <code className="rounded bg-[var(--bb-bg-warm)] px-1 py-0.5 text-xs">/</code> within a
          minute thanks to ISR. Phase 1 ships the hero block; remaining sections still ship from
          code and become editable in subsequent phases.
        </p>
      </div>

      <OwnerOnlyBanner action="edit landing-page content" />

      {/* Hero section ------------------------------------------------- */}
      <section className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-6 py-5 shadow-sm">
        <header className="mb-5 border-b border-[var(--bb-border-subtle)] pb-3">
          <h2 className="text-lg font-semibold tracking-tight">Hero</h2>
          <p className="mt-1 text-xs text-[var(--bb-text-secondary)]">
            The above-the-fold area visitors see first. Pick a layout variant, then fill in the
            headline, subhead, and call-to-action. Image-based variants need a hero photo uploaded
            to R2.
          </p>
        </header>

        <HeroBlockForm initial={initialHero} pageKey={PAGE_KEY} />
      </section>

      {/* How it works ------------------------------------------------- */}
      <section className="mt-6 rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-6 py-5 shadow-sm">
        <header className="mb-5 border-b border-[var(--bb-border-subtle)] pb-3">
          <h2 className="text-lg font-semibold tracking-tight">How it works</h2>
          <p className="mt-1 text-xs text-[var(--bb-text-secondary)]">
            The numbered steps section under the hero. Add 1 to 5 steps, reorder them, and add an
            optional eyebrow + section title above the grid.
          </p>
        </header>

        <HowItWorksBlockForm initial={initialHowItWorks} pageKey={PAGE_KEY} />
      </section>

      {/* FAQ ---------------------------------------------------------- */}
      <section className="mt-6 rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-6 py-5 shadow-sm">
        <header className="mb-5 border-b border-[var(--bb-border-subtle)] pb-3">
          <h2 className="text-lg font-semibold tracking-tight">FAQ</h2>
          <p className="mt-1 text-xs text-[var(--bb-text-secondary)]">
            The accordion of question/answer pairs near the bottom of the page. Add up to 40
            Q&amp;As, reorder them, customise the section title and subtitle.
          </p>
        </header>

        <FaqBlockForm initial={initialFaq} pageKey={PAGE_KEY} />
      </section>

      {/* Future sections ---------------------------------------------- */}
      <section className="mt-6 rounded-2xl border border-dashed border-[var(--bb-border)] bg-[var(--bb-bg-warm)] px-6 py-5">
        <h2 className="text-sm font-semibold tracking-tight text-[var(--bb-text-secondary)]">
          More sections coming soon
        </h2>
        <p className="mt-1 text-xs text-[var(--bb-text-tertiary)]">
          Pricing, showcase, why-Brandbite, and the call-to-action band will become editable in
          upcoming phases. Until then, those sections render from the hardcoded copy in the page
          source.
        </p>
      </section>
    </>
  );
}
