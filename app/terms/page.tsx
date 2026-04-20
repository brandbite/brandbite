// @file: app/terms/page.tsx
// @purpose: Terms of Service — CMS-managed. Admin edits via /admin/pages
//           using pageKey "terms". Required for launch (Stripe checkout).

import { CmsPageView } from "@/components/marketing/cms-page-view";

export const metadata = {
  title: "Terms of Service — Brandbite",
};

export default function TermsPage() {
  return <CmsPageView pageKey="terms" />;
}
