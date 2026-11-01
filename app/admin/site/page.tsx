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
//
//           Tabs: Header navigation / Footer & legal bar. The legal bar
//           lives in the SITE_FOOTER payload and saves with the footer, so
//           it stays inside the footer tab as its own section.
// -----------------------------------------------------------------------------
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-04-30
// -----------------------------------------------------------------------------

import { OwnerOnlyBanner } from "@/components/admin/owner-only-banner";
import { Callout, PageHeader } from "@/components/admin/v2/ui";
import { TabbedPanels } from "@/components/blocks/admin/block-form-ui";
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
      <PageHeader
        title="Site chrome"
        description="Header navigation, footer links and the legal bar shown on the older marketing pages."
      />

      <OwnerOnlyBanner action="edit site header and footer" />

      <div className="mb-6">
        <Callout title="Where this shows up">
          Documentation, News, Showcase and Accessibility pages use this header and footer. The
          homepage and the redesigned pages (About, Blog, FAQ, Contact, Privacy, Terms…) use their
          own static header and footer and ignore these settings. Logo and copyright year stay in
          code.
        </Callout>
      </div>

      <TabbedPanels
        label="Site chrome sections"
        sections={[
          {
            id: "header",
            label: "Header navigation",
            description:
              "Links between the brand logo and the Sign in button. Up to 10 entries, in order.",
            content: <SiteHeaderBlockForm initial={initialHeader} />,
          },
          {
            id: "footer",
            label: "Footer & legal bar",
            description:
              "Brand statement, the multi-column link grid and the orange legal-link strip at the very bottom. All three save together.",
            content: <SiteFooterBlockForm initial={initialFooter} />,
          },
        ]}
      />
    </>
  );
}
