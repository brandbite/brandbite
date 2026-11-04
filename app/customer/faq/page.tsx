// -----------------------------------------------------------------------------
// @file: app/customer/faq/page.tsx
// @purpose: Logged-in FAQ page for company members. Same content as the public
//           /faq, but rendered inside the customer dashboard chrome.
// -----------------------------------------------------------------------------

import { PageHeader, TextLink } from "@/components/admin/v2/ui";
import { FaqExplorer } from "@/components/dashboard/help/faq-explorer";

export default function CustomerFaqPage() {
  return (
    <>
      <PageHeader
        title="Frequently Asked Questions"
        description="Everything you need to know about using brandbite. Can't find what you're looking for? Contact your account manager or reach out via the consultation feature."
      />
      <FaqExplorer
        footer={
          <>
            <TextLink href="/customer/support">Open support guides</TextLink>
            <TextLink href="/customer/consultation">Book a consultation</TextLink>
          </>
        }
      />
    </>
  );
}
