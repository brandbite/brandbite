// -----------------------------------------------------------------------------
// @file: app/admin/site/page.tsx
// @purpose: Admin route for editing the site-wide chrome — the header
//           and footer that render on every marketing page (not just the
//           landing page). Hosts SiteHeaderBlockForm + SiteFooterBlockForm.
//
//           Stores its blocks under pageKey="global" so they reuse the
//           same /api/admin/page-blocks pipeline as page-specific blocks
//           but live in their own namespace separate from "home" (the
//           landing-page blocks).
// -----------------------------------------------------------------------------
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-04-30
// -----------------------------------------------------------------------------

import { OwnerOnlyBanner } from "@/components/admin/owner-only-banner";
import { SiteFooterBlockForm } from "@/components/blocks/admin/SiteFooterBlockForm";
import { SiteHeaderBlockForm } from "@/components/blocks/admin/SiteHeaderBlockForm";

import { getPageBlocks } from "@/lib/blocks/get-page-blocks";
import { DEFAULT_SITE_FOOTER_DATA, DEFAULT_SITE_HEADER_DATA } from "@/lib/blocks/defaults";
import { BLOCK_TYPES, type SiteFooterData, type SiteHeaderData } from "@/lib/blocks/types";

const PAGE_KEY = "global";

export default async function AdminSiteChromePage() {
  const blocks = await getPageBlocks(PAGE_KEY);

  const headerBlock = blocks.find((b) => b.type === BLOCK_TYPES.SITE_HEADER);
  const initialHeader: SiteHeaderData =
    headerBlock && headerBlock.type === BLOCK_TYPES.SITE_HEADER
      ? headerBlock.data
      : DEFAULT_SITE_HEADER_DATA;

  const footerBlock = blocks.find((b) => b.type === BLOCK_TYPES.SITE_FOOTER);
  const initialFooter: SiteFooterData =
    footerBlock && footerBlock.type === BLOCK_TYPES.SITE_FOOTER
      ? footerBlock.data
      : DEFAULT_SITE_FOOTER_DATA;

  return (
    <>
      {/* Page header */}
      <div className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Site header &amp; footer</h1>
        <p className="mt-1 text-sm text-[var(--bb-text-secondary)]">
          Chrome that wraps every marketing page — landing, pricing, showcase, blog, FAQ, legal.
          Edits land within ~60 seconds via ISR; logo and copyright year stay in code.
        </p>
      </div>

      <OwnerOnlyBanner action="edit site header and footer" />

      {/* Header section ---------------------------------------------- */}
      <section className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-6 py-5 shadow-sm">
        <header className="mb-5 border-b border-[var(--bb-border-subtle)] pb-3">
          <h2 className="text-lg font-semibold tracking-tight">Header navigation</h2>
          <p className="mt-1 text-xs text-[var(--bb-text-secondary)]">
            The links between the brand logo and the Sign in button on every marketing page. Add up
            to 10 entries, reorder them, customise label and destination per link.
          </p>
        </header>

        <SiteHeaderBlockForm initial={initialHeader} />
      </section>

      {/* Footer section ---------------------------------------------- */}
      <section className="mt-6 rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-6 py-5 shadow-sm">
        <header className="mb-5 border-b border-[var(--bb-border-subtle)] pb-3">
          <h2 className="text-lg font-semibold tracking-tight">Footer</h2>
          <p className="mt-1 text-xs text-[var(--bb-text-secondary)]">
            Brand statement, multi-column link grid, and the orange legal-link strip at the very
            bottom of every marketing page.
          </p>
        </header>

        <SiteFooterBlockForm initial={initialFooter} />
      </section>
    </>
  );
}
