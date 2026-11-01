// -----------------------------------------------------------------------------
// @file: lib/fonts/admin.ts
// @purpose: Plus Jakarta Sans — the typeface of the admin design language v1
//           (Brandbite_Tasarim_Dili, Nov 2026). Loaded per-page while the
//           admin screens migrate one by one; pages that opt in add
//           `adminFont.variable` + the `bb-admin-v2` class to their root.
// -----------------------------------------------------------------------------

import { Plus_Jakarta_Sans } from "next/font/google";

export const adminFont = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-jakarta",
});
