// @file: app/accessibility/page.tsx
// @purpose: Accessibility statement — CMS-managed. Admin edits via /admin/pages
//           using pageKey "accessibility". Publishes Brandbite's WCAG 2.2 AA
//           conformance posture and the contact channel for a11y complaints.

import type { Metadata } from "next";

import { CmsPageView } from "@/components/marketing/cms-page-view";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Accessibility Statement",
  description:
    "How brandbite works toward WCAG 2.2 AA across its website and app, and how to tell us about an accessibility problem.",
  path: "/accessibility",
});

export default function AccessibilityPage() {
  return <CmsPageView pageKey="accessibility" />;
}
