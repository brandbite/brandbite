// -----------------------------------------------------------------------------
// @file: app/creative/faq/page.tsx
// @purpose: Logged-in FAQ page for creatives, showing only the questions written
//           for them. The rest of the FAQ speaks to customers.
// -----------------------------------------------------------------------------

import { PageHeader, TextLink } from "@/components/admin/v2/ui";
import { FaqExplorer } from "@/components/dashboard/help/faq-explorer";

export default function CreativeFaqPage() {
  return (
    <>
      <PageHeader
        title="Frequently Asked Questions"
        description="How brandbite works from the creative side: getting requests, delivering work and getting paid."
      />
      <FaqExplorer
        endpoint="/api/creative/faq"
        footer={<TextLink href="/creative/support">Open support guides</TextLink>}
      />
    </>
  );
}
