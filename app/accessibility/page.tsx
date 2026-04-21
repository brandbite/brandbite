// @file: app/accessibility/page.tsx
// @purpose: Accessibility statement — CMS-managed. Admin edits via /admin/pages
//           using pageKey "accessibility". Publishes Brandbite's WCAG 2.2 AA
//           conformance posture and the contact channel for a11y complaints.

import { CmsPageView } from "@/components/marketing/cms-page-view";

export const metadata = {
  title: "Accessibility — Brandbite",
};

export default function AccessibilityPage() {
  return <CmsPageView pageKey="accessibility" />;
}
