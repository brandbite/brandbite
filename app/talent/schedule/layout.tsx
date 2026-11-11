// -----------------------------------------------------------------------------
// @file: app/talent/schedule/layout.tsx
// @purpose: Interview scheduling links are personal (tokenized), so they stay
//           out of search results even though /talent itself is indexed.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pick your interview time",
  robots: { index: false, follow: false },
};

export default function TalentScheduleLayout({ children }: { children: React.ReactNode }) {
  return children;
}
