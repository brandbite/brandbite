// @file: app/cookies/page.tsx
// @purpose: Cookie Policy — CMS-managed. Admin edits via /admin/pages using
//           pageKey "cookies". Linked from the marketing footer and from
//           cookie-banner consent flows.

import { CmsPageView } from "@/components/marketing/cms-page-view";

export const metadata = {
  title: "Cookie Policy — Brandbite",
};

export default function CookiesPage() {
  return <CmsPageView pageKey="cookies" />;
}
