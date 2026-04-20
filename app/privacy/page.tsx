// @file: app/privacy/page.tsx
// @purpose: Privacy policy — CMS-managed. Admin edits via /admin/pages using
//           pageKey "privacy". Required for launch (GDPR, Stripe checkout).

import { CmsPageView } from "@/components/marketing/cms-page-view";

export const metadata = {
  title: "Privacy Policy — Brandbite",
};

export default function PrivacyPage() {
  return <CmsPageView pageKey="privacy" />;
}
