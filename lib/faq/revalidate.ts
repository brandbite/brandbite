// -----------------------------------------------------------------------------
// @file: lib/faq/revalidate.ts
// @purpose: Shared helper to invalidate the prerender + edge caches that
//           depend on Faq table contents. Called after every admin
//           create/update/delete so changes propagate within seconds.
//
//           Wrapped in try/catch because revalidatePath can throw if Next's
//           runtime is in an unusual state (e.g. during build). Failure
//           here shouldn't block the save — ISR will pick up the change
//           within ~60s anyway, this just shortens the visible window.
// -----------------------------------------------------------------------------

import "server-only";

import { revalidatePath } from "next/cache";

export function bustFaqCaches() {
  try {
    revalidatePath("/api/faq");
    revalidatePath("/faq");
    revalidatePath("/customer/faq");
    revalidatePath("/creative/faq");
    revalidatePath("/");
  } catch (err) {
    console.warn("[faq] revalidate failed", err);
  }
}
