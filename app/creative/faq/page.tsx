// -----------------------------------------------------------------------------
// @file: app/creative/faq/page.tsx
// @purpose: Logged-in FAQ page for creatives. Filtered to the categories most
//           relevant to creative workflow (hides customer-focused pricing /
//           agency topics that don't apply to contributors).
// -----------------------------------------------------------------------------

import { PageHeader, TextLink } from "@/components/admin/v2/ui";
import { FaqExplorer } from "@/components/dashboard/help/faq-explorer";

// Creatives care about the product basics and how the creative process works,
// but billing and agency plans are customer-facing concerns.
const CREATIVE_CATEGORIES = ["All", "General", "Creative Process", "Platform & Tools"] as const;

export default function CreativeFaqPage() {
  return (
    <>
      <PageHeader
        title="Frequently Asked Questions"
        description="How brandbite works from the creative side — requests, delivery, file formats, and platform tools."
      />
      <FaqExplorer
        categories={CREATIVE_CATEGORIES}
        footer={<TextLink href="/creative/support">Open support guides</TextLink>}
      />
    </>
  );
}
